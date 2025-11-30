import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { currentUser, profiles, type Profile } from "@/lib/data";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Filter, Heart, Maximize2, MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";

interface FilterState {
  ageMin: number;
  ageMax: number;
  intention: "all" | "friend" | "date";
  interestedInYou: boolean;
  matchedWith: boolean;
}

interface ChatMessage {
  id: number;
  sender: "user" | "other";
  text: string;
}

export default function Home() {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [likedProfiles, setLikedProfiles] = useState<Set<number>>(new Set());
  const [showFilter, setShowFilter] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [chatProfile, setChatProfile] = useState<Profile | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 1, sender: "other", text: "Hey! How are you doing?" },
    { id: 2, sender: "user", text: "I'm doing great! How about you?" },
    { id: 3, sender: "other", text: "Pretty good! Would love to grab coffee sometime" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    ageMin: 18,
    ageMax: 65,
    intention: "all",
    interestedInYou: false,
    matchedWith: false,
  });

  // Calculate positions for concentric circles
  const rings = [
    { radius: 140, count: 6, startIndex: 0 },
    { radius: 240, count: 8, startIndex: 6 },
    { radius: 340, count: 11, startIndex: 14 },
  ];

  const toggleLike = (profileId: number) => {
    const newLiked = new Set(likedProfiles);
    if (newLiked.has(profileId)) {
      newLiked.delete(profileId);
    } else {
      newLiked.add(profileId);
    }
    setLikedProfiles(newLiked);
  };

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      setChatMessages([
        ...chatMessages,
        { id: chatMessages.length + 1, sender: "user", text: chatInput },
      ]);
      setChatInput("");
    }
  };

  return (
    <div className="min-h-screen w-full overflow-hidden bg-background font-body relative flex flex-col">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/hero-bg.png')] bg-cover bg-center" />
      </div>

      {/* Decorative Geometric Shapes */}
      <div className="absolute top-10 left-10 w-20 h-20 bg-secondary rounded-none rotate-12 opacity-20 z-0" />
      <div className="absolute bottom-20 right-10 w-32 h-32 bg-primary rounded-full opacity-10 z-0" />
      <div className="absolute top-1/4 right-1/4 w-16 h-16 border-4 border-accent rotate-45 z-0" />

      {/* Header Section */}
      <div className="relative z-20 pt-6 px-4 sm:px-6 md:px-8">
        <div className="max-w-6xl mx-auto flex items-start justify-between">
          {/* Left: Branding */}
          <div>
            <h1 className="text-5xl sm:text-6xl font-bold text-foreground" style={{ fontFamily: "Fredoka, sans-serif" }}>
              Meet Cute
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground font-body mt-2">
              Find people near you
            </p>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-start gap-3">
            {/* Notification Button */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="flex items-center justify-center w-10 h-10 text-foreground hover:text-primary transition-colors"
            >
              <Bell className="h-6 w-6" />
            </button>

            {/* Chat Button */}
            <button
              onClick={() => {
                setShowChat(true);
                setChatProfile(profiles[0]);
              }}
              className="flex items-center justify-center w-10 h-10 text-foreground hover:text-secondary transition-colors"
            >
              <MessageCircle className="h-6 w-6" />
            </button>

            {/* Filter Button */}
            <div className="relative">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className="flex items-center justify-center w-10 h-10 text-foreground hover:text-primary transition-colors"
              >
                <Filter className="h-6 w-6" />
              </button>

              {/* Filter Dropdown */}
              <AnimatePresence>
                {showFilter && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="absolute top-full right-0 mt-2 w-80 bg-background border-2 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 z-50"
                >
                  {/* Age Filter */}
                  <div className="space-y-4 mb-6">
                    <h3 className="font-display text-lg text-foreground">Age Range</h3>
                    <div className="space-y-3">
                      <Slider
                        min={18}
                        max={65}
                        step={1}
                        value={[filters.ageMin, filters.ageMax]}
                        onValueChange={(value) =>
                          setFilters({
                            ...filters,
                            ageMin: value[0],
                            ageMax: value[1],
                          })
                        }
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground font-body">
                        <span>{filters.ageMin}</span>
                        <span>{filters.ageMax}</span>
                      </div>
                    </div>
                  </div>

                  {/* Intention Filter */}
                  <div className="space-y-4 mb-6 border-t-2 border-border pt-6">
                    <h3 className="font-display text-lg text-foreground">Intention</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          id="intention-all"
                          name="intention"
                          value="all"
                          checked={filters.intention === "all"}
                          onChange={(e) =>
                            setFilters({ ...filters, intention: e.target.value as any })
                          }
                          className="w-4 h-4 border-2 border-black cursor-pointer"
                        />
                        <Label htmlFor="intention-all" className="cursor-pointer font-body">
                          All
                        </Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          id="intention-friend"
                          name="intention"
                          value="friend"
                          checked={filters.intention === "friend"}
                          onChange={(e) =>
                            setFilters({ ...filters, intention: e.target.value as any })
                          }
                          className="w-4 h-4 border-2 border-black cursor-pointer"
                        />
                        <Label htmlFor="intention-friend" className="cursor-pointer font-body">
                          Friend
                        </Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          id="intention-date"
                          name="intention"
                          value="date"
                          checked={filters.intention === "date"}
                          onChange={(e) =>
                            setFilters({ ...filters, intention: e.target.value as any })
                          }
                          className="w-4 h-4 border-2 border-black cursor-pointer"
                        />
                        <Label htmlFor="intention-date" className="cursor-pointer font-body">
                          Date
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Interested in You */}
                  <div className="space-y-3 border-t-2 border-border pt-6 mb-6">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="interested"
                        checked={filters.interestedInYou}
                        onCheckedChange={(checked) =>
                          setFilters({ ...filters, interestedInYou: checked as boolean })
                        }
                        className="w-5 h-5 border-2 border-black"
                      />
                      <Label htmlFor="interested" className="cursor-pointer font-body">
                        People interested in you
                      </Label>
                    </div>
                  </div>

                  {/* Matched With */}
                  <div className="space-y-3 border-t-2 border-border pt-6">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="matched"
                        checked={filters.matchedWith}
                        onCheckedChange={(checked) =>
                          setFilters({ ...filters, matchedWith: checked as boolean })
                        }
                        className="w-5 h-5 border-2 border-black"
                      />
                      <Label htmlFor="matched" className="cursor-pointer font-body">
                        People you have matched with
                      </Label>
                    </div>
                  </div>

                    {/* Close Button */}
                    <Button
                      onClick={() => setShowFilter(false)}
                      className="w-full mt-6 bg-foreground text-background border-2 border-black rounded-none font-bold"
                    >
                      Done
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Popup */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full w-96 bg-background border-l-2 border-black shadow-[-8px_0px_0px_0px_rgba(0,0,0,1)] z-50 flex flex-col"
          >
            {/* Notifications Header */}
            <div className="flex items-center justify-between p-4 border-b-2 border-black sticky top-0 bg-background">
              <h2 className="font-display text-xl text-foreground">Notifications</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotifications(false)}
                className="hover:bg-accent"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto space-y-3 p-4">
              {profiles.slice(0, 5).map((profile) => (
                <motion.div
                  key={profile.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 border-2 border-black rounded-none bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setChatProfile(profile);
                    setShowChat(true);
                    setShowNotifications(false);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={profile.image}
                      alt="Profile"
                      className="w-12 h-12 rounded-full border-2 border-black object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-display text-sm text-foreground">You matched!</p>
                      <p className="text-xs text-muted-foreground font-body">Just now</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container - Centered */}
      <div className="flex-1 flex items-center justify-center relative z-10 w-full overflow-hidden">
        <div className="w-full max-w-[800px] aspect-square flex items-center justify-center scale-[0.5] sm:scale-[0.65] md:scale-[0.85] lg:scale-100 transition-transform duration-500">
          
          {/* Center Profile (You) */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="relative z-50"
          >
            <div 
              className="w-32 h-32 rounded-full border-4 border-primary bg-background p-1 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:scale-105 transition-transform duration-200"
              onClick={() => {
                setSelectedProfile(currentUser);
                setIsFullScreen(false);
              }}
            >
              <Avatar className="w-full h-full">
                <AvatarImage src={currentUser.image} alt="You" className="object-cover" />
                <AvatarFallback className="bg-accent text-accent-foreground font-display text-2xl">ME</AvatarFallback>
              </Avatar>
            </div>
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-1 font-display text-lg whitespace-nowrap shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
              You
            </div>
          </motion.div>

          {/* Concentric Rings */}
          {rings.map((ring, ringIndex) => {
            const ringProfiles = profiles.slice(ring.startIndex, ring.startIndex + ring.count);
            
            return (
              <div key={ringIndex} className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* Ring Guide Line */}
                <div 
                  className="absolute rounded-full border-2 border-dashed border-muted-foreground/20"
                  style={{ width: ring.radius * 2, height: ring.radius * 2 }}
                />

                {ringProfiles.map((profile, index) => {
                  const angle = (index / ring.count) * 2 * Math.PI;
                  const x = Math.cos(angle) * ring.radius;
                  const y = Math.sin(angle) * ring.radius;

                  return (
                    <motion.div
                      key={profile.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 260, 
                        damping: 20, 
                        delay: 0.1 + (ringIndex * 0.1) + (index * 0.05) 
                      }}
                      className="absolute pointer-events-auto"
                      style={{ 
                        transform: `translate(${x}px, ${y}px)`,
                        marginLeft: x,
                        marginTop: y
                      }}
                    >
                      <div 
                        className="group relative"
                        onClick={() => {
                          setSelectedProfile(profile);
                          setIsFullScreen(false);
                        }}
                      >
                        <div className="w-16 h-16 rounded-full border-2 border-border bg-background p-0.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:scale-110 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:border-primary transition-all duration-200 overflow-hidden">
                          <Avatar className="w-full h-full">
                            <AvatarImage src={profile.image} alt={profile.name} className="object-cover" />
                            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                              {profile.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        
                        {/* Tooltip on Hover */}
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-foreground text-background text-xs px-2 py-0.5 whitespace-nowrap font-bold pointer-events-none z-50">
                          {profile.name}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Circular Profile Popup Modal */}
      <AnimatePresence>
        {selectedProfile && !isFullScreen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setSelectedProfile(null)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="relative w-80 h-80 rounded-full border-4 border-black bg-background shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
            >
              {/* Large Circular Image */}
              <div className="w-full h-full rounded-full overflow-hidden">
                <img
                  src={selectedProfile.image}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Like Button (Bottom Left) */}
              <button
                onClick={() => toggleLike(selectedProfile.id)}
                className="absolute bottom-4 left-4 w-10 h-10 rounded-full bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center hover:scale-110 transition-transform z-50"
              >
                <Heart
                  className={`h-5 w-5 ${
                    likedProfiles.has(selectedProfile.id)
                      ? "fill-secondary text-secondary"
                      : "text-black"
                  }`}
                />
              </button>

              {/* Expand Button (Bottom Right) */}
              <button
                onClick={() => setIsFullScreen(true)}
                className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-primary border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center hover:scale-110 transition-transform z-50"
              >
                <Maximize2 className="h-5 w-5 text-primary-foreground" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Profile View (Dating App Style) */}
      <AnimatePresence>
        {selectedProfile && isFullScreen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 bg-background overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b-2 border-black bg-background sticky top-0 z-50">
              <div />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullScreen(false)}
                className="border-2 border-black hover:bg-accent"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              {/* First Image */}
              <div className="w-full aspect-square bg-gradient-to-br from-primary to-secondary relative overflow-hidden flex items-center justify-center">
                <img
                  src={selectedProfile.image}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Profile Details */}
              <div className="p-6 space-y-6">
                {/* Name, Title, Flag, Work */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">🇺🇸</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="inline-block bg-accent text-accent-foreground px-4 py-2 text-sm font-bold uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      💼 Finance
                    </div>
                  </div>
                </div>

                {/* Second Image */}
                <div className="w-full aspect-square bg-gradient-to-br from-secondary to-accent relative overflow-hidden flex items-center justify-center border-2 border-black">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=600&fit=crop"
                    alt="Gallery"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Prompts Section */}
                <div className="space-y-4">
                  <h3 className="font-display text-lg text-foreground">Prompts</h3>
                  
                  <div className="bg-muted/30 border-2 border-black p-4 rounded-none">
                    <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1">Looking for...</p>
                    <p className="text-base text-foreground font-body">Someone who loves spontaneous adventures and good conversations over coffee.</p>
                  </div>

                  <div className="bg-muted/30 border-2 border-black p-4 rounded-none">
                    <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1">Ideal weekend</p>
                    <p className="text-base text-foreground font-body">Hiking in the morning, farmers market for lunch, and a movie night at home.</p>
                  </div>

                  <div className="bg-muted/30 border-2 border-black p-4 rounded-none">
                    <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1">My superpower</p>
                    <p className="text-base text-foreground font-body">I can make anyone laugh and I am great at giving genuine advice to friends.</p>
                  </div>

                  <div className="bg-muted/30 border-2 border-black p-4 rounded-none">
                    <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1">Pet peeve</p>
                    <p className="text-base text-foreground font-body">People who do not listen actively or are always on their phones during conversations.</p>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-muted/30 border-2 border-black p-4 rounded-none">
                  <h3 className="font-display text-lg text-foreground mb-2">About</h3>
                  <p className="text-base text-muted-foreground font-body leading-relaxed">
                    {selectedProfile.description}
                  </p>
                </div>

                {/* Spacer for scrolling */}
                <div className="h-20" />
              </div>
            </div>

            {/* Sticky Footer Actions */}
            <div className="border-t-2 border-black bg-background p-4 sticky bottom-0 flex gap-3">
              {selectedProfile.id === currentUser.id ? (
                <Button className="flex-1 bg-foreground text-background hover:bg-foreground/90 border-2 border-transparent rounded-none font-bold">
                  Edit Profile
                </Button>
              ) : (
                <Button 
                  onClick={() => toggleLike(selectedProfile.id)}
                  className={`flex-1 border-2 border-black rounded-none font-bold transition-all ${
                    likedProfiles.has(selectedProfile.id)
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-background text-foreground hover:bg-secondary/20"
                  }`}
                >
                  <Heart className={`h-5 w-5 mr-2 ${likedProfiles.has(selectedProfile.id) ? "fill-current" : ""}`} />
                  Like
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Popup */}
      <AnimatePresence>
        {showChat && chatProfile && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t-2 border-black rounded-t-2xl shadow-[0_-8px_0px_0px_rgba(0,0,0,1)] max-h-[80vh] flex flex-col"
          >
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b-2 border-black bg-background sticky top-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectedProfile(chatProfile);
                    setIsFullScreen(true);
                    setShowChat(false);
                  }}
                  className="w-12 h-12 rounded-full border-2 border-black overflow-hidden hover:scale-110 transition-transform"
                >
                  <img src={chatProfile.image} alt="Chat" className="w-full h-full object-cover" />
                </button>
                <div>
                  <h3 className="font-display text-lg text-foreground">Chat</h3>
                  <p className="text-xs text-muted-foreground">Online</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowChat(false)}
                className="border-2 border-black hover:bg-accent"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg border-2 border-black ${
                      msg.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <p className="text-sm font-body">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="border-t-2 border-black p-4 bg-background sticky bottom-0 flex gap-2">
              <Input
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1 border-2 border-black rounded-none font-body"
              />
              <Button
                onClick={handleSendMessage}
                className="bg-primary text-primary-foreground border-2 border-black rounded-none font-bold"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
