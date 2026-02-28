import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { load, Store } from "@tauri-apps/plugin-store";
import { useNavigate } from "react-router-dom";
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
  } = useApp();
  
  const navigate = useNavigate();
  
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
      navigate("/albums");
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
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm mx-auto px-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1 text-center">
            {t.loginTitle}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 text-center">
            {t.loginSubtitle}
          </p>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 text-sm rounded-lg p-3 mb-4 border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}

          {step === "credentials" && (
            <form onSubmit={handleFetchKids} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t.email}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder={t.emailPlaceholder}
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t.password}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
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
                  className="mr-2 h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600"
                  disabled={loading}
                />
                <label htmlFor="rememberMe" className="text-sm text-gray-700 dark:text-gray-300">
                  {t.rememberMe}
                </label>
              </div>
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-blue-600 dark:bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? t.loggingIn : t.logIn}
              </button>
            </form>
          )}

          {step === "select_kid" && (
            <form onSubmit={handleSelectKid} className="space-y-5">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t.multipleKindergartens}
              </p>
              <div className="space-y-2">
                {kindergartens.map((kid) => (
                  <label
                    key={kid.id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedKid?.id === kid.id
                        ? "border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="kindergarten"
                      checked={selectedKid?.id === kid.id}
                      onChange={() => setSelectedKid(kid)}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-900 dark:text-gray-100">{kid.name}</span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs ml-auto">
                      ID: {kid.id}
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="submit"
                disabled={loading || !selectedKid}
                className="w-full bg-blue-600 dark:bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? t.loggingIn : t.continue}
              </button>
              <button
                type="button"
                onClick={() => setStep("credentials")}
                className="w-full text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
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
