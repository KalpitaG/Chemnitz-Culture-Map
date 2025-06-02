/* eslint-disable @typescript-eslint/no-explicit-any */
/* src/components/auth/Login.tsx */
import React, { useState } from "react";
import { useAuth } from "../../Context/AuthContext";

export default function Login() {
  const { signin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signin({ email, password });
      // On success, AuthContext will redirect to "/"
    } catch (err: any) {
      // err.response.data.detail is what our FastAPI returns (e.g. "Incorrect email or password")
      const detail =
        err.response?.data?.detail || "Login failed. Please try again.";
      setError(detail);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md bg-white border rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-center mb-6">Log In</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label className="block mb-2">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full mt-1 px-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-300"
            />
          </label>
          <label className="block mb-4">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full mt-1 px-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-300"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Logging in…" : "Log In"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-4">
          Don’t have an account?{" "}
          <a href="/signup" className="text-blue-600 hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
