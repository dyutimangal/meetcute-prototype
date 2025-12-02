import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim()) {
      alert("Please fill in all fields");
      return;
    }
    
    setIsLoading(true);
    // Simulate login delay
    setTimeout(() => {
      // Store user info in localStorage
      localStorage.setItem("meetCuteUser", JSON.stringify({ username, email }));
      setLocation("/");
      setIsLoading(false);
    }, 500);
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

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-background border-4 border-black rounded-none shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-bold text-foreground" style={{ fontFamily: "Fredoka, sans-serif" }}>
              meetcute
            </h1>
            <p className="text-sm text-muted-foreground font-body">
              Find people near you
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username Input */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-foreground font-body">
                Username
              </label>
              <Input
                type="text"
                placeholder="Enter your username"
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

            {/* Buttons */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-foreground text-background border-2 border-black rounded-none font-bold text-base py-3 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-shadow disabled:opacity-50"
              >
                {isLoading ? "Loading..." : "Login"}
              </Button>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t-2 border-border" />
            <span className="text-xs text-muted-foreground font-body uppercase tracking-wider">or</span>
            <div className="flex-1 border-t-2 border-border" />
          </div>

          {/* Sign Up Button */}
          <Button
            type="button"
            onClick={() => setLocation("/register")}
            className="w-full bg-accent text-accent-foreground border-2 border-black rounded-none font-bold text-base py-3 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-shadow flex items-center justify-center gap-2"
          >
            Sign Up
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
