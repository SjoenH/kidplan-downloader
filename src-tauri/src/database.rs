use anyhow::{Context, Result};
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Face {
    pub id: i64,
    pub image_path: String,
    pub bounding_box: BoundingBox,
    pub embedding: Vec<f32>,
    pub confidence: f64,
    pub cluster_id: Option<i64>,
    pub label: Option<String>,
    pub thumbnail_path: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceCluster {
    pub id: i64,
    pub label: Option<String>,
    pub representative_face_id: i64,
    pub face_count: i64,
    pub sample_thumbnail_path: Option<String>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoWithFace {
    pub image_path: String,
    pub faces: Vec<Face>,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    /// Create a new database connection and initialize schema
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path).context("Failed to open database")?;

        let db = Database { conn };
        db.init_schema()?;
        Ok(db)
    }

    /// Initialize database schema
    fn init_schema(&self) -> Result<()> {
        self.conn
            .execute(
                "CREATE TABLE IF NOT EXISTS faces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_path TEXT NOT NULL,
                bounding_box TEXT NOT NULL,
                embedding BLOB NOT NULL,
                confidence REAL NOT NULL,
                cluster_id INTEGER,
                label TEXT,
                thumbnail_path TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )",
                [],
            )
            .context("Failed to create faces table")?;

        self.conn
            .execute(
                "CREATE TABLE IF NOT EXISTS clusters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                label TEXT,
                representative_face_id INTEGER NOT NULL,
                face_count INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
                [],
            )
            .context("Failed to create clusters table")?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_cluster ON faces(cluster_id)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_image_path ON faces(image_path)",
            [],
        )?;

        Ok(())
    }

    /// Insert a new face detection
    pub fn insert_face(
        &self,
        image_path: &str,
        bounding_box: &BoundingBox,
        embedding: &[f32],
        confidence: f64,
        thumbnail_path: &str,
    ) -> Result<i64> {
        let bbox_json = serde_json::to_string(bounding_box)?;
        let embedding_bytes: Vec<u8> = embedding.iter().flat_map(|f| f.to_le_bytes()).collect();

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;

        self.conn.execute(
            "INSERT INTO faces (image_path, bounding_box, embedding, confidence, thumbnail_path, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                image_path,
                bbox_json,
                embedding_bytes,
                confidence,
                thumbnail_path,
                timestamp
            ],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    /// Get all faces without cluster assignment
    pub fn get_unclustered_faces(&self) -> Result<Vec<Face>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, image_path, bounding_box, embedding, confidence, cluster_id, label, thumbnail_path, created_at
             FROM faces
             WHERE cluster_id IS NULL"
        )?;

        let faces = stmt
            .query_map([], |row| self.face_from_row(row))?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(faces)
    }

    /// Get all faces
    pub fn get_all_faces(&self) -> Result<Vec<Face>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, image_path, bounding_box, embedding, confidence, cluster_id, label, thumbnail_path, created_at
             FROM faces"
        )?;

        let faces = stmt
            .query_map([], |row| self.face_from_row(row))?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(faces)
    }

    /// Update cluster assignment for a face
    pub fn update_face_cluster(&self, face_id: i64, cluster_id: Option<i64>) -> Result<()> {
        self.conn.execute(
            "UPDATE faces SET cluster_id = ?1 WHERE id = ?2",
            params![cluster_id, face_id],
        )?;
        Ok(())
    }

    /// Create a new cluster
    pub fn create_cluster(&self, representative_face_id: i64, face_count: i64) -> Result<i64> {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;

        self.conn.execute(
            "INSERT INTO clusters (representative_face_id, face_count, updated_at)
             VALUES (?1, ?2, ?3)",
            params![representative_face_id, face_count, timestamp],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    /// Get all clusters
    pub fn get_all_clusters(&self) -> Result<Vec<FaceCluster>> {
        let mut stmt = self.conn.prepare(
            "SELECT c.id, c.label, c.representative_face_id, c.face_count, c.updated_at, f.thumbnail_path
             FROM clusters c
             LEFT JOIN faces f ON c.representative_face_id = f.id
             ORDER BY c.face_count DESC",
        )?;

        let clusters = stmt
            .query_map([], |row| {
                Ok(FaceCluster {
                    id: row.get(0)?,
                    label: row.get(1)?,
                    representative_face_id: row.get(2)?,
                    face_count: row.get(3)?,
                    updated_at: row.get(4)?,
                    sample_thumbnail_path: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(clusters)
    }

    /// Get all faces for a specific cluster
    pub fn get_cluster_faces(&self, cluster_id: i64) -> Result<Vec<Face>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, image_path, bounding_box, embedding, confidence, cluster_id, label, thumbnail_path, created_at
             FROM faces
             WHERE cluster_id = ?1"
        )?;

        let faces = stmt
            .query_map([cluster_id], |row| self.face_from_row(row))?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(faces)
    }

    /// Assign label to a cluster
    pub fn assign_cluster_label(&self, cluster_id: i64, label: &str) -> Result<()> {
        // Update cluster
        self.conn.execute(
            "UPDATE clusters SET label = ?1 WHERE id = ?2",
            params![label, cluster_id],
        )?;

        // Update all faces in cluster
        self.conn.execute(
            "UPDATE faces SET label = ?1 WHERE cluster_id = ?2",
            params![label, cluster_id],
        )?;

        Ok(())
    }

    /// Merge multiple clusters into one
    pub fn merge_clusters(&self, cluster_ids: &[i64], new_label: Option<&str>) -> Result<i64> {
        if cluster_ids.is_empty() {
            anyhow::bail!("No clusters to merge");
        }

        // Get all faces from clusters being merged
        let placeholders = cluster_ids
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(",");

        let query = format!(
            "SELECT COUNT(*) FROM faces WHERE cluster_id IN ({})",
            placeholders
        );

        let mut stmt = self.conn.prepare(&query)?;
        let params: Vec<&dyn rusqlite::ToSql> = cluster_ids
            .iter()
            .map(|id| id as &dyn rusqlite::ToSql)
            .collect();
        let face_count: i64 = stmt.query_row(&params[..], |row| row.get(0))?;

        // Get representative face (first face from first cluster)
        let query = format!("SELECT id FROM faces WHERE cluster_id = ?1 LIMIT 1");
        let representative_face_id: i64 = self
            .conn
            .query_row(&query, [cluster_ids[0]], |row| row.get(0))?;

        // Create new cluster
        let new_cluster_id = self.create_cluster(representative_face_id, face_count)?;

        if let Some(label) = new_label {
            self.assign_cluster_label(new_cluster_id, label)?;
        }

        // Update all faces to new cluster
        let query = format!(
            "UPDATE faces SET cluster_id = ?1 WHERE cluster_id IN ({})",
            placeholders
        );
        let mut params: Vec<&dyn rusqlite::ToSql> = vec![&new_cluster_id as &dyn rusqlite::ToSql];
        params.extend(cluster_ids.iter().map(|id| id as &dyn rusqlite::ToSql));

        self.conn.execute(&query, &params[..])?;

        // Delete old clusters
        let query = format!("DELETE FROM clusters WHERE id IN ({})", placeholders);
        let params: Vec<&dyn rusqlite::ToSql> = cluster_ids
            .iter()
            .map(|id| id as &dyn rusqlite::ToSql)
            .collect();
        self.conn.execute(&query, &params[..])?;

        Ok(new_cluster_id)
    }

    /// Clear all face data
    /// Clear all clusters and reset face cluster assignments (but keep faces)
    pub fn clear_clusters(&self) -> Result<()> {
        // Delete all clusters
        self.conn.execute("DELETE FROM clusters", [])?;
        // Reset cluster_id for all faces
        self.conn
            .execute("UPDATE faces SET cluster_id = NULL", [])?;
        Ok(())
    }

    pub fn clear_all(&self) -> Result<()> {
        self.conn.execute("DELETE FROM faces", [])?;
        self.conn.execute("DELETE FROM clusters", [])?;
        Ok(())
    }

    /// Helper to convert row to Face
    fn face_from_row(&self, row: &Row) -> rusqlite::Result<Face> {
        let bbox_json: String = row.get(2)?;
        let bounding_box: BoundingBox = serde_json::from_str(&bbox_json)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

        let embedding_bytes: Vec<u8> = row.get(3)?;
        let embedding: Vec<f32> = embedding_bytes
            .chunks_exact(4)
            .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
            .collect();

        Ok(Face {
            id: row.get(0)?,
            image_path: row.get(1)?,
            bounding_box,
            embedding,
            confidence: row.get(4)?,
            cluster_id: row.get(5)?,
            label: row.get(6)?,
            thumbnail_path: row.get(7)?,
            created_at: row.get(8)?,
        })
    }
}
