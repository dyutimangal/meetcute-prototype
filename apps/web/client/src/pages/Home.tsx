import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { profiles as seedProfiles } from "@/lib/data";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Filter, Heart, Maximize2, MessageCircle, Send, X } from "lucide-react";
import { useState, useEffect } from "react";

type ApiUser = {
  username?: string;
  email?: string;
  avatar?: string;
  age?: number;
  gender?: string;
  interestedIn?: string[];
  prompts?: Record<string, string>;
  likedYou?: boolean;
  likedByYou?: boolean;
  matchStatus?: "default" | "liked" | "matched";
};

const DEFAULT_PROMPTS = {
  lookingFor: "Someone who loves spontaneous adventures and good conversations over coffee.",
  idealWeekend: "Hiking in the morning, farmers market for lunch, and a movie night at home.",
  superpower: "I can make anyone laugh and I am great at giving genuine advice to friends.",
  petPeeve: "People who do not listen actively or are always on their phones during conversations.",
};

const GENDER_OPTIONS = ["male", "female", "non-binary"];
const INTEREST_OPTIONS = ["girls", "guys", "non-binary"];

interface Profile {
  id: string;
  name: string;
  description: string;
  image?: string;
  age?: number;
  gender?: string;
  interestedIn?: string[];
  prompts?: Record<keyof typeof DEFAULT_PROMPTS, string>;
  likedYou?: boolean;
  likedByYou?: boolean;
  matchStatus?: "default" | "liked" | "matched";
}

const PROMPT_LABELS: Array<{ key: keyof typeof DEFAULT_PROMPTS; label: string }> = [
  { key: "lookingFor", label: "Looking for..." },
  { key: "idealWeekend", label: "Ideal weekend" },
  { key: "superpower", label: "My superpower" },
  { key: "petPeeve", label: "Pet peeve" },
];

const mergePrompts = (
  prompts?: Record<string, string>
): Record<keyof typeof DEFAULT_PROMPTS, string> => ({
  ...DEFAULT_PROMPTS,
  ...(prompts || {}),
});

const formatLabelValue = (value?: string | number) => {
  if (value === null || typeof value === "undefined" || value === "") return "—";
  return String(value);
};

const formatListValue = (value?: string[]) => {
  if (!value || value.length === 0) return "—";
  return value.map((item) => item.replace(/-/g, " ")).join(", ");
};

const getStoredUser = () => {
  const raw = localStorage.getItem("meetCuteUser");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const username = parsed?.username ? String(parsed.username).trim().toLowerCase() : "";
    const email = parsed?.email ? String(parsed.email).trim().toLowerCase() : "";
    return { raw, username, email };
  } catch {
    return { raw, username: raw.trim().toLowerCase(), email: "" };
  }
};

const pickSeedProfile = (key: string, index: number) => {
  if (seedProfiles.length === 0) return null;
  if (!key) return seedProfiles[index % seedProfiles.length];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return seedProfiles[hash % seedProfiles.length];
};

const BASE_RING_COUNTS = [6, 8, 11];

const buildRings = (total: number) => {
  const rings: Array<{ radius: number; count: number }> = [];
  const baseRadius = 150;
  const spacing = 120;
  const minSlots = Math.max(total, BASE_RING_COUNTS.reduce((sum, n) => sum + n, 0));
  let remaining = minSlots;
  let ringIndex = 0;
  while (remaining > 0) {
    const baseCount =
      BASE_RING_COUNTS[ringIndex] ??
      BASE_RING_COUNTS[BASE_RING_COUNTS.length - 1] + (ringIndex - BASE_RING_COUNTS.length + 1) * 2;
    rings.push({ radius: baseRadius + ringIndex * spacing, count: baseCount });
    remaining -= baseCount;
    ringIndex += 1;
  }
  return rings;
};

const buildRingSlotsByRing = (rings: Array<{ radius: number; count: number }>) => {
  return rings.map((ring, ringIndex) => {
    return Array.from({ length: ring.count }, (_, slotIndex) => ({
      ringIndex,
      slotIndex,
      ringCount: ring.count,
      radius: ring.radius,
      angle: (slotIndex / ring.count) * 2 * Math.PI,
    }));
  });
};

const hashSeed = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

function seededShuffle<T>(items: T[], seedKey: string) {
  const arr = [...items];
  let seed = hashSeed(seedKey || "seed");
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function interleaveSlots<T>(slotsByRing: T[][], seedKey: string) {
  const shuffledByRing = slotsByRing.map((slots, ringIndex) =>
    seededShuffle(slots, `${seedKey}|ring:${ringIndex}`)
  );
  const result: T[] = [];
  let offset = 0;
  let added = true;
  while (added) {
    added = false;
    for (const ringSlots of shuffledByRing) {
      if (offset < ringSlots.length) {
        result.push(ringSlots[offset]);
        added = true;
      }
    }
    offset += 1;
  }
  return result;
}

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
  const [likedProfiles, setLikedProfiles] = useState<Set<string>>(new Set());
  const [showFilter, setShowFilter] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [chatProfile, setChatProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editImage, setEditImage] = useState("");
  const [editPrompts, setEditPrompts] = useState<Record<keyof typeof DEFAULT_PROMPTS, string>>(DEFAULT_PROMPTS);
  const [editAge, setEditAge] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editInterestedIn, setEditInterestedIn] = useState<string[]>([]);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 1, sender: "other", text: "Hey! How are you doing?" },
    { id: 2, sender: "user", text: "I'm doing great! How about you?" },
    { id: 3, sender: "other", text: "Pretty good! Would love to grab coffee sometime" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupData, setSetupData] = useState({
    age: "",
    intention: [] as string[],
    identification: "",
    interestedIn: [] as string[],
    preferredAgeMin: "",
    preferredAgeMax: "",
  });
  const [filters, setFilters] = useState<FilterState>({
    ageMin: 18,
    ageMax: 65,
    intention: "all",
    interestedInYou: false,
    matchedWith: false,
  });

  useEffect(() => {
    // Check if user has completed setup
    const stored = getStoredUser();
    if (stored?.raw) {
      const setupKey = `meetCuteUserSetup_${stored.raw}`;
      const userSetup = localStorage.getItem(setupKey);
      if (!userSetup) {
        setShowSetupModal(true);
      }
    }
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored?.username) return;

    const loadUsers = async () => {
      setProfilesError(null);
      try {
        const params = new URLSearchParams();
        params.set("exclude", stored.username);
        params.set("minAge", String(filters.ageMin));
        params.set("maxAge", String(filters.ageMax));
        if (filters.intention === "friend") {
          params.set("intention", "friendship,friends");
        }
        if (filters.intention === "date") {
          params.set("intention", "dating");
        }
        const [meResponse, usersResponse] = await Promise.all([
          fetch(`/api/users/${encodeURIComponent(stored.username)}`),
          fetch(`/api/users?${params.toString()}`),
        ]);

        if (meResponse.ok) {
          const meUser = (await meResponse.json()) as ApiUser;
          const template = pickSeedProfile(stored.username, 0);
          setCurrentUserProfile({
            id: stored.username,
            name: stored.username,
            description: "This is you.",
            image: meUser.avatar || template?.image || "",
            age: meUser.age,
            gender: meUser.gender,
            interestedIn: meUser.interestedIn,
            prompts: mergePrompts(meUser.prompts),
          });
        } else {
          setCurrentUserProfile({
            id: stored.username,
            name: stored.username,
            description: "This is you.",
            image: "",
            prompts: mergePrompts(),
          });
        }

        if (!usersResponse.ok) {
          throw new Error(`Failed to load users (${usersResponse.status})`);
        }
        const list = (await usersResponse.json()) as ApiUser[];
        const mapped = Array.isArray(list)
          ? list
              .filter((user) => user && user.username)
              .map((user, index) => {
                const username = String(user.username);
                const template = pickSeedProfile(username, index);
                return {
                  id: username,
                  name: username,
                  description: template?.description || "MeetCute user.",
                  image: user.avatar || template?.image || "",
                  age: user.age,
                  gender: user.gender,
                  interestedIn: user.interestedIn,
                  prompts: mergePrompts(user.prompts),
                  likedYou: user.likedYou,
                  likedByYou: user.likedByYou,
                  matchStatus: user.matchStatus,
                };
              })
          : [];
        setLikedProfiles(new Set(mapped.filter((profile) => profile.likedByYou).map((profile) => profile.id)));

        let filtered = mapped;
        if (filters.interestedInYou) {
          filtered = filtered.filter((profile) => profile.likedYou);
        }
        if (filters.matchedWith) {
          filtered = filtered.filter((profile) => profile.matchStatus === "matched");
        }
        setProfiles(filtered);
      } catch (err) {
        console.error(err);
        setProfilesError("Unable to load users.");
      }
    };

    loadUsers();
  }, [filters]);

  useEffect(() => {
    if (!selectedProfile) return;
    const currentId = currentUserProfile?.id || "you";
    if (selectedProfile.id === currentId) {
      setEditImage(selectedProfile.image || "");
      setEditPrompts(mergePrompts(selectedProfile.prompts));
      setEditAge(
        typeof selectedProfile.age === "number" && !Number.isNaN(selectedProfile.age)
          ? String(selectedProfile.age)
          : ""
      );
      setEditGender(selectedProfile.gender || "");
      setEditInterestedIn(selectedProfile.interestedIn || []);
    }
    setIsEditingProfile(false);
    setProfileSaveError(null);
  }, [selectedProfile, currentUserProfile]);

  const handleSetupComplete = async () => {
    if (!setupData.age || setupData.intention.length === 0 || !setupData.identification || setupData.interestedIn.length === 0 || !setupData.preferredAgeMin || !setupData.preferredAgeMax) {
      alert("Please fill in all fields");
      return;
    }
    // Save setup data with user-specific key
    const storedUser = localStorage.getItem("meetCuteUser");
    const setupKey = `meetCuteUserSetup_${storedUser}`;
    localStorage.setItem(setupKey, JSON.stringify(setupData));
    // Also save a flag that setup is complete
    localStorage.setItem("meetCuteUserSetup", "true");
    setShowSetupModal(false);

    const stored = getStoredUser();
    if (stored?.username) {
      try {
        const updatedFields = {
          age: Number(setupData.age),
          gender: setupData.identification,
          interestedIn: setupData.interestedIn,
        };
        await fetch(`/api/users/${encodeURIComponent(stored.username)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            age: updatedFields.age,
            gender: updatedFields.gender,
            intention: setupData.intention,
            interestedIn: updatedFields.interestedIn,
            preferredAgeRange: {
              min: Number(setupData.preferredAgeMin),
              max: Number(setupData.preferredAgeMax),
            },
          }),
        });
        setCurrentUserProfile((prev) => (prev ? { ...prev, ...updatedFields } : prev));
        setSelectedProfile((prev) => (prev && prev.id === stored.username ? { ...prev, ...updatedFields } : prev));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const toggleIntention = (value: string) => {
    setSetupData((prev) => ({
      ...prev,
      intention: prev.intention.includes(value)
        ? prev.intention.filter((i) => i !== value)
        : [...prev.intention, value],
    }));
  };

  const toggleInterestedIn = (value: string) => {
    setSetupData((prev) => ({
      ...prev,
      interestedIn: prev.interestedIn.includes(value)
        ? prev.interestedIn.filter((i) => i !== value)
        : [...prev.interestedIn, value],
    }));
  };

  const activeCurrentUser: Profile = currentUserProfile || {
    id: "you",
    name: "You",
    description: "This is you.",
    image: "",
    prompts: mergePrompts(),
  };
  const rings = buildRings(profiles.length);
  const ringSlotsByRing = buildRingSlotsByRing(rings);
  const slotSeed = profiles.map((profile) => profile.id).sort().join("|");
  const shuffledSlots = interleaveSlots(ringSlotsByRing, slotSeed);
  const positionedProfiles = profiles
    .map((profile, index) => {
      const slot = shuffledSlots[index];
      if (!slot) return null;
      const x = Math.cos(slot.angle) * slot.radius;
      const y = Math.sin(slot.angle) * slot.radius;
      return { profile, slot, x, y };
    })
    .filter(Boolean) as Array<{
    profile: Profile;
    slot: { ringIndex: number; slotIndex: number; ringCount: number };
    x: number;
    y: number;
  }>;

  const handleLike = async (profileId: string) => {
    const stored = getStoredUser();
    if (!stored?.username) return;
    if (likedProfiles.has(profileId)) return;

    const nextLiked = new Set(likedProfiles);
    nextLiked.add(profileId);
    setLikedProfiles(nextLiked);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(profileId)}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ likerUsername: stored.username }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setLikedProfiles((prev) => {
          const updated = new Set(prev);
          updated.delete(profileId);
          return updated;
        });
        setProfilesError(payload?.error || "Unable to like user.");
        return;
      }
      setProfiles((prev) =>
        prev.map((profile) => {
          if (profile.id !== profileId) return profile;
          const nextStatus = profile.likedYou ? "matched" : "liked";
          return {
            ...profile,
            likedByYou: true,
            matchStatus: nextStatus,
          };
        })
      );
    } catch (err) {
      console.error(err);
      setLikedProfiles((prev) => {
        const updated = new Set(prev);
        updated.delete(profileId);
        return updated;
      });
      setProfilesError("Unable to like user.");
    }
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

  const handlePromptChange = (key: keyof typeof DEFAULT_PROMPTS, value: string) => {
    setEditPrompts((prev) => ({ ...prev, [key]: value }));
  };

  const toggleEditInterestedIn = (value: string) => {
    setEditInterestedIn((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleSaveProfile = async () => {
    const stored = getStoredUser();
    if (!stored?.username) return;
    setIsSavingProfile(true);
    setProfileSaveError(null);
    try {
      const normalizedAge = editAge.trim();
      const payloadAge = normalizedAge === "" ? null : Number(normalizedAge);
      const response = await fetch(`/api/users/${encodeURIComponent(stored.username)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatar: editImage,
          age: payloadAge,
          gender: editGender,
          interestedIn: editInterestedIn,
          prompts: editPrompts,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProfileSaveError(payload?.error || "Unable to save profile.");
        return;
      }

      const updatedPrompts = mergePrompts(payload.prompts || editPrompts);
      const updatedProfile = {
        ...activeCurrentUser,
        image: payload.avatar || editImage || activeCurrentUser.image,
        age: payload.age ?? payloadAge ?? activeCurrentUser.age,
        gender: payload.gender ?? editGender ?? activeCurrentUser.gender,
        interestedIn: payload.interestedIn ?? editInterestedIn ?? activeCurrentUser.interestedIn,
        prompts: updatedPrompts,
      };
      setCurrentUserProfile(updatedProfile);
      setSelectedProfile(updatedProfile);
      setIsEditingProfile(false);
    } catch (err) {
      console.error(err);
      setProfileSaveError("Unable to save profile.");
    } finally {
      setIsSavingProfile(false);
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
              meetcute
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground font-body mt-2">
              Find people near you
            </p>
            {profilesError && (
              <p className="mt-2 text-xs text-red-600 font-body">{profilesError}</p>
            )}
          </div>

          {/* Right: Action Buttons */}
          <div className="flex flex-col items-center gap-1">
            {/* Notification Button */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="flex items-center justify-center w-8 h-8 text-foreground hover:text-primary transition-colors"
            >
              <Bell className="h-5 w-5" />
            </button>

            {/* Chat Button */}
            <button
              onClick={() => {
                if (profiles.length === 0) return;
                setShowChat(true);
                setChatProfile(profiles[0]);
              }}
              className="flex items-center justify-center w-8 h-8 text-foreground hover:text-secondary transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
            </button>

            {/* Filter Button */}
            <div className="relative">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className="flex items-center justify-center w-8 h-8 text-foreground hover:text-primary transition-colors"
              >
                <Filter className="h-5 w-5" />
              </button>

              {/* Filter Dropdown */}
              <AnimatePresence>
                {showFilter && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="absolute top-full right-0 mt-1 w-80 bg-background border-2 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 z-50"
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

      {/* Setup Modal */}
      <AnimatePresence>
        {showSetupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background border-4 border-black rounded-none shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-6"
            >
              <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "Fredoka, sans-serif" }}>
                Complete Your Profile
              </h2>

              {/* Age Field */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-foreground font-body">Your Age</label>
                <Input
                  type="number"
                  min="18"
                  max="100"
                  placeholder="Enter your age"
                  value={setupData.age}
                  onChange={(e) => setSetupData({ ...setupData, age: e.target.value })}
                  className="w-full border-2 border-black rounded-none font-body"
                />
              </div>

              {/* Intention Field */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-foreground font-body">Looking For</label>
                <div className="space-y-2">
                  {["Dating", "Friends"].map((option) => (
                    <label key={option} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setupData.intention.includes(option.toLowerCase())}
                        onChange={() => toggleIntention(option.toLowerCase())}
                        className="w-5 h-5 border-2 border-black cursor-pointer"
                      />
                      <span className="font-body text-foreground">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Identification Field */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-foreground font-body">I Identify As</label>
                <div className="space-y-2">
                  {["Male", "Female", "Non-binary"].map((option) => (
                    <label key={option} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="identification"
                        value={option.toLowerCase()}
                        checked={setupData.identification === option.toLowerCase()}
                        onChange={(e) => setSetupData({ ...setupData, identification: e.target.value })}
                        className="w-5 h-5 border-2 border-black cursor-pointer"
                      />
                      <span className="font-body text-foreground">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Who You Are Into Field */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-foreground font-body">Who You Are Into</label>
                <div className="space-y-2">
                  {["Male", "Female", "Non-binary"].map((option) => (
                    <label key={option} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setupData.interestedIn.includes(option.toLowerCase())}
                        onChange={() => toggleInterestedIn(option.toLowerCase())}
                        className="w-5 h-5 border-2 border-black cursor-pointer"
                      />
                      <span className="font-body text-foreground">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preferred Age Range */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-foreground font-body">Preferred Age Range</label>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground font-body">Min</label>
                      <Input
                        type="number"
                        min="18"
                        max="100"
                        placeholder="Min"
                        value={setupData.preferredAgeMin}
                        onChange={(e) => setSetupData({ ...setupData, preferredAgeMin: e.target.value })}
                        className="w-full border-2 border-black rounded-none font-body"
                      />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground font-body">Max</label>
                    <Input
                      type="number"
                      min="18"
                      max="100"
                      placeholder="Max"
                      value={setupData.preferredAgeMax}
                      onChange={(e) => setSetupData({ ...setupData, preferredAgeMax: e.target.value })}
                      className="w-full border-2 border-black rounded-none font-body"
                    />
                  </div>
                </div>
              </div>

              {/* Complete Button */}
              <Button
                onClick={handleSetupComplete}
                className="w-full bg-accent text-accent-foreground border-2 border-black rounded-none font-bold py-3 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-shadow"
              >
                Complete Setup
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <button
                onClick={() => setShowNotifications(false)}
                className="flex items-center justify-center w-8 h-8 text-foreground hover:text-primary transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto space-y-3 p-4">
              {profiles.slice(0, 5).length === 0 ? (
                <p className="text-sm text-muted-foreground font-body">No other users yet.</p>
              ) : (
                profiles.slice(0, 5).map((profile) => (
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
                        alt={profile.name}
                        className="w-12 h-12 rounded-full border-2 border-black object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-display text-sm text-foreground">You matched!</p>
                        <p className="text-xs text-muted-foreground font-body">Just now</p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
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
                setSelectedProfile(activeCurrentUser);
                setIsFullScreen(false);
              }}
            >
              <Avatar className="w-full h-full">
                <AvatarImage src={activeCurrentUser.image} alt="You" className="object-cover" />
                <AvatarFallback className="bg-accent text-accent-foreground font-display text-2xl">ME</AvatarFallback>
              </Avatar>
            </div>
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-1 font-display text-lg whitespace-nowrap shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
              You
            </div>
          </motion.div>

          {/* Concentric Rings */}
          {rings.map((ring, ringIndex) => (
            <div key={ringIndex} className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="absolute rounded-full border-2 border-dashed border-muted-foreground/20"
                style={{ width: ring.radius * 2, height: ring.radius * 2 }}
              />
            </div>
          ))}

          {positionedProfiles.map(({ profile, slot, x, y }) => (
            <motion.div
              key={profile.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: 0.1 + slot.ringIndex * 0.1 + slot.slotIndex * 0.05,
              }}
              className="absolute pointer-events-auto"
              style={{
                transform: `translate(${x}px, ${y}px)`,
                marginLeft: x,
                marginTop: y,
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

                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-100 bg-foreground text-background text-xs px-2 py-0.5 whitespace-nowrap font-bold pointer-events-none z-50">
                  {profile.name}
                </div>
              </div>
            </motion.div>
          ))}
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

              {selectedProfile.id === activeCurrentUser.id ? (
                <button
                  onClick={() => {
                    setIsEditingProfile(true);
                    setIsFullScreen(true);
                  }}
                  className="absolute bottom-4 left-4 px-3 h-10 rounded-full bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center hover:scale-105 transition-transform z-50 text-xs font-bold uppercase tracking-wider"
                >
                  Edit
                </button>
              ) : (
                <button
                  onClick={() => handleLike(selectedProfile.id)}
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
              )}

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
                  src={
                    isEditingProfile && selectedProfile.id === activeCurrentUser.id
                      ? editImage || selectedProfile.image
                      : selectedProfile.image
                  }
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Profile Details */}
              <div className="p-6 space-y-6">
                {/* Profile Info */}
                <div className="space-y-3">
                  <h2 className="font-display text-2xl text-foreground">{selectedProfile.name}</h2>
                  {isEditingProfile && selectedProfile.id === activeCurrentUser.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-body mb-1">
                            Age
                          </label>
                          <Input
                            type="number"
                            min="18"
                            max="100"
                            value={editAge}
                            onChange={(e) => setEditAge(e.target.value)}
                            className="w-full border-2 border-black rounded-none font-body text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-body mb-1">
                            Gender
                          </label>
                          <select
                            value={editGender}
                            onChange={(e) => setEditGender(e.target.value)}
                            className="w-full border-2 border-black rounded-none font-body text-sm bg-background px-2 py-2"
                          >
                            <option value="">Select</option>
                            {GENDER_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-body mb-1">
                            Interested in
                          </label>
                          <div className="space-y-2">
                            {INTEREST_OPTIONS.map((option) => (
                              <label key={option} className="flex items-center gap-2 text-sm font-body">
                                <Checkbox
                                  checked={editInterestedIn.includes(option)}
                                  onCheckedChange={() => toggleEditInterestedIn(option)}
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center bg-muted/30 border-2 border-black px-3 py-1 text-xs font-bold uppercase tracking-wider">
                        Age: {formatLabelValue(selectedProfile.age)}
                      </span>
                      <span className="inline-flex items-center bg-muted/30 border-2 border-black px-3 py-1 text-xs font-bold uppercase tracking-wider">
                        Gender: {formatLabelValue(selectedProfile.gender)}
                      </span>
                      <span className="inline-flex items-center bg-muted/30 border-2 border-black px-3 py-1 text-xs font-bold uppercase tracking-wider">
                        Interested in: {formatListValue(selectedProfile.interestedIn)}
                      </span>
                    </div>
                  )}
                </div>

                {isEditingProfile && selectedProfile.id === activeCurrentUser.id && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-body">
                      Profile image URL
                    </label>
                    <Input
                      type="text"
                      value={editImage}
                      onChange={(e) => setEditImage(e.target.value)}
                      className="w-full border-2 border-black rounded-none font-body text-sm"
                      placeholder="https://..."
                    />
                  </div>
                )}

                {/* Prompts Section */}
                <div className="space-y-4">
                  <h3 className="font-display text-lg text-foreground">Prompts</h3>

                  {PROMPT_LABELS.map(({ key, label }) => (
                    <div key={key} className="bg-muted/30 border-2 border-black p-4 rounded-none">
                      <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1">
                        {label}
                      </p>
                      {isEditingProfile && selectedProfile.id === activeCurrentUser.id ? (
                        <textarea
                          value={editPrompts[key]}
                          onChange={(e) => handlePromptChange(key, e.target.value)}
                          className="w-full min-h-[72px] border-2 border-black rounded-none font-body text-sm p-2 bg-background"
                        />
                      ) : (
                        <p className="text-base text-foreground font-body">
                          {mergePrompts(selectedProfile.prompts)[key]}
                        </p>
                      )}
                    </div>
                  ))}

                  {profileSaveError && (
                    <p className="text-sm text-red-600 font-body">{profileSaveError}</p>
                  )}
                </div>

                {/* Description */}
                <div className="bg-muted/30 border-2 border-black p-4 rounded-none">
                  <h3 className="font-display text-lg text-foreground mb-2">About</h3>
                  <p className="text-base text-muted-foreground font-body leading-relaxed">
                    {selectedProfile.description || "MeetCute user."}
                  </p>
                </div>

                {/* Spacer for scrolling */}
                <div className="h-20" />
              </div>
            </div>

            {/* Sticky Footer Actions */}
            <div className="border-t-2 border-black bg-background p-4 sticky bottom-0 flex gap-3">
              {selectedProfile.id === activeCurrentUser.id ? (
                isEditingProfile ? (
                  <>
                    <Button
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="flex-1 bg-foreground text-background hover:bg-foreground/90 border-2 border-transparent rounded-none font-bold"
                    >
                      {isSavingProfile ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setEditImage(selectedProfile.image || "");
                        setEditPrompts(mergePrompts(selectedProfile.prompts));
                        setEditAge(
                          typeof selectedProfile.age === "number" && !Number.isNaN(selectedProfile.age)
                            ? String(selectedProfile.age)
                            : ""
                        );
                        setEditGender(selectedProfile.gender || "");
                        setEditInterestedIn(selectedProfile.interestedIn || []);
                      }}
                      className="flex-1 border-2 border-black rounded-none font-bold"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setIsEditingProfile(true)}
                    className="flex-1 bg-foreground text-background hover:bg-foreground/90 border-2 border-transparent rounded-none font-bold"
                  >
                    Edit Profile
                  </Button>
                )
              ) : (
                <Button 
                  onClick={() => handleLike(selectedProfile.id)}
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
