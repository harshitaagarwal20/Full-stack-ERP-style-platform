import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { logApiError } from "../utils/apiError";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading } = useAuth();

  const [form, setForm] = useState({
    email: "admin@fms.com",
    password: "Admin@123"
  });
  const [error, setError] = useState("");
  const authMessage = location.state?.message || "";

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err) {
      setError(logApiError(err, "Login failed."));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-200 via-white to-slate-200 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">FMS Login</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in with your role credentials.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="input" value={form.email} onChange={onChange} required />
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" className="input" value={form.password} onChange={onChange} required />
          </div>

          {(authMessage || error) && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {authMessage || error}
            </p>
          )}

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? <LoadingSpinner label="Signing in..." /> : "Login"}
          </button>
        </form>

      </div>
    </div>
  );
}

export default LoginPage;
