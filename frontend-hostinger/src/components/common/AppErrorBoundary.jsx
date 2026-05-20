import { Component } from "react";

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Application render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
            color: "#0f172a"
          }}
        >
          <div
            style={{
              maxWidth: "420px",
              width: "100%",
              background: "#ffffff",
              borderRadius: "20px",
              padding: "24px",
              boxShadow: "0 20px 45px rgba(15, 23, 42, 0.12)"
            }}
          >
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>Something went wrong</h1>
            <p style={{ margin: "12px 0 20px", color: "#475569", lineHeight: 1.6 }}>
              The app hit a runtime error while loading. Refresh the page to try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: "none",
                borderRadius: "12px",
                padding: "12px 16px",
                background: "#0f172a",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
