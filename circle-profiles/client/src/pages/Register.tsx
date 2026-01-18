import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim()) {
      alert("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const normalizedUsername = username.trim().toLowerCase();
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalizedUsername, email: normalizedEmail }),
      });

      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : await response.text().catch(() => "");

      if (!response.ok) {
        if (payload && typeof payload === "object" && "error" in payload) {
          setError(String(payload.error));
        } else if (payload && typeof payload === "string") {
          setError(payload);
        } else {
          setError(`Registration failed (${response.status}). Please try again.`);
        }
        return;
      }

      const user = typeof payload === "object" && payload ? payload : {};
      localStorage.setItem(
        "meetCuteUser",
        JSON.stringify({ username: user.username || normalizedUsername, email: user.email || normalizedEmail })
      );
      setLocation("/user");
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background overflow-hidden flex items-center justify-center relative">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/hero-bg.png')] bg-cover bg-center" />
      </div>

      {/* Decorative Geometric Shapes */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-secondary rounded-none rotate-12 opacity-20 z-0" />
      <div className="absolute bottom-20 right-10 w-48 h-48 bg-primary rounded-full opacity-10 z-0" />
      <div className="absolute top-1/3 right-1/4 w-24 h-24 border-4 border-accent rotate-45 z-0" />
      <div className="absolute bottom-1/4 left-1/4 w-20 h-20 bg-accent rounded-none opacity-15 z-0" />

      {/* Register Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-background border-4 border-black rounded-none shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] p-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <h1 className="text-6xl font-bold text-foreground" style={{ fontFamily: "Fredoka, sans-serif" }}>
              Join Us
            </h1>
            <p className="text-lg text-muted-foreground font-body">
              Create your Meet Cute account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-5">
            {/* Username Input */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-foreground font-body">
                Username
              </label>
              <Input
                type="text"
                placeholder="Choose your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border-2 border-black rounded-none font-body text-base py-3 px-4"
                disabled={isLoading}
              />
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-foreground font-body">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-2 border-black rounded-none font-body text-base py-3 px-4"
                disabled={isLoading}
              />
            </div>

            {/* Register Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-accent text-accent-foreground border-2 border-black rounded-none font-bold text-base py-3 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-shadow disabled:opacity-50"
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-red-600 font-body" role="alert">
                {error}
              </p>
            )}
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t-2 border-border" />
            <span className="text-xs text-muted-foreground font-body uppercase tracking-wider">or</span>
            <div className="flex-1 border-t-2 border-border" />
          </div>

          {/* Back to Login */}
          <Button
            type="button"
            onClick={() => setLocation("/login")}
            variant="ghost"
            className="w-full flex items-center justify-center gap-2 text-foreground hover:bg-muted/30 font-body"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Button>
        </div>

        {/* Footer Text */}
        <p className="text-center text-xs text-muted-foreground font-body mt-6">
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
