import { AlertTriangle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import EmptyState from "./EmptyState";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render-time exceptions that would otherwise blank the whole
 * page — hooks can't do this, it has to be a class component. Wraps
 * <AnimatedRoutes /> in App.tsx so a broken page shows this instead of a
 * white screen with nothing but a console error to go on. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="glass" style={{ padding: 40, margin: "40px auto", maxWidth: 480 }}>
          <EmptyState
            icon={AlertTriangle}
            title="Something went wrong"
            subtitle={this.state.error.message || "An unexpected error occurred while rendering this page."}
            action={
              <button className="btn" style={{ marginTop: 16 }} onClick={() => this.setState({ error: null })}>
                Try again
              </button>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}
