import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { load, Store } from "@tauri-apps/plugin-store";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../i18n/LanguageContext";
import type { Kindergarten } from "../types";

export default function LoginPage() {
  const {
    setCredentials,
    setKindergartens,
    kindergartens,
    selectedKid,
    setSelectedKid,
    setPage,
  } = useApp();
  
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "select_kid">("credentials");

  // Load saved credentials on mount
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const store = await load("credentials.json");
        const savedEmail = await store.get<string>("email");
        const savedPassword = await store.get<string>("password");
        if (savedEmail && savedPassword) {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberMe(true);
        }
      } catch (err) {
        console.log("No saved credentials found");
      }
    };
    loadSavedCredentials();
  }, []);

  const saveCredentials = async (store: Store) => {
    await store.set("email", email);
    await store.set("password", password);
    await store.save();
  };

  const clearCredentials = async (store: Store) => {
    await store.delete("email");
    await store.delete("password");
    await store.save();
  };

  const handleFetchKids = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const kids = await invoke<Kindergarten[]>("get_kindergartens", {
        credentials: { email, password },
      });
      setCredentials({ email, password });
      setKindergartens(kids);
      
      // Save or clear credentials based on remember me checkbox
      const store = await load("credentials.json");
      if (rememberMe) {
        await saveCredentials(store);
      } else {
        await clearCredentials(store);
      }
      
      if (kids.length === 1) {
        setSelectedKid(kids[0]);
        await doLogin(kids[0].id);
      } else {
        setStep("select_kid");
        setLoading(false);
      }
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  };

  const doLogin = async (kidId: number) => {
    setLoading(true);
    setError("");
    try {
      await invoke("login", {
        credentials: { email, password },
        kidId,
      });
      setPage("albums");
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  };

  const handleSelectKid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKid) return;
    await doLogin(selectedKid.id);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-1 text-center">
            {t.loginTitle}
          </h1>
          <p className="text-gray-500 text-sm mb-6 text-center">
            {t.loginSubtitle}
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded p-3 mb-4">
              {error}
            </div>
          )}

          {step === "credentials" && (
            <form onSubmit={handleFetchKids} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.email}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t.emailPlaceholder}
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.password}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t.passwordPlaceholder}
                  required
                  disabled={loading}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="mr-2"
                  disabled={loading}
                />
                <label htmlFor="rememberMe" className="text-sm text-gray-700">
                  {t.rememberMe}
                </label>
              </div>
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? t.loggingIn : t.logIn}
              </button>
            </form>
          )}

          {step === "select_kid" && (
            <form onSubmit={handleSelectKid} className="space-y-4">
              <p className="text-sm text-gray-600">
                {t.multipleKindergartens}
              </p>
              <div className="space-y-2">
                {kindergartens.map((kid) => (
                  <label
                    key={kid.id}
                    className={`flex items-center p-3 border rounded-md cursor-pointer transition ${
                      selectedKid?.id === kid.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="kindergarten"
                      checked={selectedKid?.id === kid.id}
                      onChange={() => setSelectedKid(kid)}
                      className="mr-3"
                    />
                    <span className="text-gray-800">{kid.name}</span>
                    <span className="text-gray-400 text-xs ml-auto">
                      ID: {kid.id}
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="submit"
                disabled={loading || !selectedKid}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? t.loggingIn : t.continue}
              </button>
              <button
                type="button"
                onClick={() => setStep("credentials")}
                className="w-full text-gray-500 text-sm hover:text-gray-700"
              >
                {t.back}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
