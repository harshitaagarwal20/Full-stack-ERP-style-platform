import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <div className="page-card text-center">
      <h2 className="text-2xl font-bold">Page not found</h2>
      <p className="mt-2 text-slate-600">The page you are trying to access does not exist.</p>
      <Link className="btn-primary mt-4" to="/">Go Home</Link>
    </div>
  );
}

export default NotFoundPage;
