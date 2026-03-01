use rusqlite::{Connection, Result};
use std::env;

fn main() -> Result<()> {
    let home = env::var("HOME").unwrap();
    let db_path = format!(
        "{}/Library/Application Support/kidplan-downloader/faces/faces.db",
        home
    );

    let conn = Connection::open(db_path)?;

    // Get all embeddings
    let mut stmt = conn.prepare("SELECT id, embedding FROM faces LIMIT 5")?;
    let mut rows = stmt.query([])?;

    println!("Analyzing first 5 face embeddings:\n");

    while let Some(row) = rows.next()? {
        let id: i64 = row.get(0)?;
        let embedding_bytes: Vec<u8> = row.get(1)?;

        // Convert bytes to f32 vec
        let embedding: Vec<f32> = embedding_bytes
            .chunks_exact(4)
            .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
            .collect();

        // Calculate statistics
        let min = embedding.iter().fold(f32::INFINITY, |a, &b| a.min(b));
        let max = embedding.iter().fold(f32::NEG_INFINITY, |a, &b| a.max(b));
        let mean = embedding.iter().sum::<f32>() / embedding.len() as f32;
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();

        println!(
            "Face ID {}: len={}, min={:.6}, max={:.6}, mean={:.6}, L2norm={:.6}",
            id,
            embedding.len(),
            min,
            max,
            mean,
            norm
        );
        println!("  First 10 values: {:?}", &embedding[..10]);
        println!();
    }

    // Now compare similarity between first 2 faces
    let mut stmt = conn.prepare("SELECT embedding FROM faces LIMIT 2")?;
    let embeddings: Vec<Vec<f32>> = stmt
        .query_map([], |row| {
            let bytes: Vec<u8> = row.get(0)?;
            Ok(bytes
                .chunks_exact(4)
                .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
                .collect())
        })?
        .collect::<Result<Vec<_>>>()?;

    if embeddings.len() >= 2 {
        let dot: f32 = embeddings[0]
            .iter()
            .zip(&embeddings[1])
            .map(|(a, b)| a * b)
            .sum();
        let norm_a: f32 = embeddings[0].iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = embeddings[1].iter().map(|x| x * x).sum::<f32>().sqrt();
        let similarity = dot / (norm_a * norm_b);

        println!("Cosine similarity between faces 1 and 2: {:.6}", similarity);
    }

    Ok(())
}
