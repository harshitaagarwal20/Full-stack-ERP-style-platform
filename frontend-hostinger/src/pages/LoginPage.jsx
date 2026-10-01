import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { getUserFacingErrorMessage, getValidationFieldErrors } from "../utils/errorMessages";

// Signed-out password reset: email -> OTP sent -> OTP + new password.
function ForgotPasswordForm({ initialEmail, onDone, onCancel }) {
  const [email, setEmail] = useState(initialEmail || "");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sendOtp = async () => {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/auth/forgot-password/otp", { email: email.trim() });
      setOtpSent(true);
      setOtp("");
      setNotice(`${data?.message || "If an account exists for that email, an OTP has been sent to it."} It expires in ${data?.expiresInMinutes || 10} minutes.`);
    } catch (err) {
      console.error(err);
      setError(getUserFacingErrorMessage(err, "Could not send the OTP. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setError("");
    setNotice("");
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit OTP from your email.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/forgot-password/reset", {
        email: email.trim(),
        otp,
        new_password: newPassword
      });
      onDone(email.trim());
    } catch (err) {
      console.error(err);
      setError(getUserFacingErrorMessage(err, "Could not reset the password. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    if (otpSent) resetPassword();
    else sendOtp();
  };

  return (
    <form className="mt-6 space-y-4" onSubmit={onSubmit} autoComplete="off">
      <div>
        <label className="label" htmlFor="resetEmail">Email</label>
        <input
          id="resetEmail"
          type="email"
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={otpSent}
          required
        />
      </div>

      {otpSent && (
        <>
          <div>
            <label className="label" htmlFor="resetOtp">OTP (6 digits)</label>
            <input
              id="resetOtp"
              className="input tracking-widest"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="resetNewPassword">New password</label>
            <input
              id="resetNewPassword"
              type="password"
              className="input"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="resetConfirmPassword">Confirm new password</label>
            <input
              id="resetConfirmPassword"
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
        </>
      )}

      {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? <LoadingSpinner label="Please wait..." /> : otpSent ? "Reset password" : "Send OTP"}
      </button>

      <div className="flex justify-between text-sm">
        <button type="button" className="text-slate-600 hover:underline" onClick={onCancel} disabled={busy}>
          Back to login
        </button>
        {otpSent && (
          <button type="button" className="text-brand-700 hover:underline" onClick={sendOtp} disabled={busy}>
            Resend OTP
          </button>
        )}
      </div>
    </form>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetDone, setResetDone] = useState("");
  const authMessage = location.state?.message || "";

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResetDone("");
    setFieldErrors({});

    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err) {
      console.error(err);
      setFieldErrors(getValidationFieldErrors(err));
      setError(getUserFacingErrorMessage(err, "Login failed. Please try again."));
    }
  };

  const onResetDone = (email) => {
    setForgotOpen(false);
    setForm({ email, password: "" });
    setError("");
    setResetDone("Password reset. Log in with your new password.");
  };

  const hasFieldError = (field) => Boolean(fieldErrors[field]?.length);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-200 via-white to-slate-200 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">{forgotOpen ? "Reset Password" : "Login"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {forgotOpen
            ? "We'll email a 6-digit OTP to your account's address."
            : "Sign in with your role credentials."}
        </p>

        {forgotOpen ? (
          <ForgotPasswordForm
            initialEmail={form.email}
            onDone={onResetDone}
            onCancel={() => setForgotOpen(false)}
          />
        ) : (
        <form className="mt-6 space-y-4" onSubmit={onSubmit} autoComplete="on">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              className={`input ${hasFieldError("email") ? "input-error" : ""}`}
              value={form.email}
              onChange={onChange}
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
            />
            {hasFieldError("email") ? (
              <small className="field-error">{fieldErrors.email[0]}</small>
            ) : null}
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className={`input ${hasFieldError("password") ? "input-error" : ""}`}
              value={form.password}
              onChange={onChange}
              autoComplete="current-password"
              required
            />
            {hasFieldError("password") ? (
              <small className="field-error">{fieldErrors.password[0]}</small>
            ) : null}
            <div className="mt-1 text-right">
              <button
                type="button"
                className="text-sm text-brand-700 hover:underline"
                onClick={() => {
                  setError("");
                  setResetDone("");
                  setForgotOpen(true);
                }}
              >
                Forgot password?
              </button>
            </div>
          </div>

          {resetDone && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{resetDone}</p>
          )}

          {(authMessage || error) && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {authMessage || error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? <LoadingSpinner label="Signing in..." /> : "Login"}
          </button>
        </form>
        )}

      </div>
    </div>
  );
}

export default LoginPage;
