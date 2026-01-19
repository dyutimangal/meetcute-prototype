import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { profiles as seedProfiles } from "@/lib/data";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Filter, Heart, ImagePlus, LogOut, Maximize2, MessageCircle, Send, X } from "lucide-react";
import { useState, useEffect, useId } from "react";
import { useLocation } from "wouter";

type ApiUser = {
  username?: string;
  email?: string;
  avatar?: string;
  avatarSecondary?: string;
  age?: number;
  gender?: string;
  interestedIn?: string[];
  intention?: string[];
  preferredAgeRange?: { min?: number; max?: number };
  prompts?: Record<string, string>;
  likedYou?: boolean;
  likedByYou?: boolean;
  matchStatus?: "default" | "liked" | "matched";
};

const PROMPT_PLACEHOLDER = "I am too lazy for this shit";
const TARGET_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2048;

const DEFAULT_PROMPTS = {
  lookingFor: "",
  idealWeekend: "",
  superpower: "",
  petPeeve: "",
};

const loadImageFromFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read the image file. Please try another photo."));
    };
    img.src = url;
  });

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("Unable to process the image. Please try another photo."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      reject(new Error("Unable to process the image. Please try another photo."));
    };
    reader.readAsDataURL(blob);
  });

const compressImageToDataUrl = async (file: File) => {
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Please upload a PNG or JPEG image.");
  }
  const image = await loadImageFromFile(file);
  let width = image.width;
  let height = image.height;
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  let quality = 0.9;
  let blob: Blob | null = null;
  let attempt = 0;

  // Reduce quality first, then scale down dimensions if still too large.
  while (attempt < 10) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to process the image. Please try another photo.");
    }
    ctx.drawImage(image, 0, 0, width, height);
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) {
      throw new Error("Unable to process the image. Please try another photo.");
    }
    if (blob.size <= TARGET_IMAGE_BYTES) {
      break;
    }
    if (quality > 0.65) {
      quality -= 0.1;
    } else {
      width = Math.max(320, Math.round(width * 0.85));
      height = Math.max(320, Math.round(height * 0.85));
    }
    attempt += 1;
  }

  return blobToDataUrl(blob);
};

const INTEREST_OPTIONS = ["girls", "guys", "non-binary"];

interface Profile {
  id: string;
  name: string;
  description: string;
  image?: string;
  imageSecondary?: string;
  age?: number;
  gender?: string;
  interestedIn?: string[];
  intention?: string[];
  preferredAgeRange?: { min?: number; max?: number };
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

const isProfileComplete = (user?: ApiUser) => {
  if (!user) return false;
  const hasAge = typeof user.age === "number" && !Number.isNaN(user.age);
  const hasGender = Boolean(user.gender);
  const hasAvatar = typeof user.avatar === "string" && user.avatar.trim().length > 0;
  const hasIntention = Array.isArray((user as any).intention) && (user as any).intention.length > 0;
  const hasInterestedIn = Array.isArray(user.interestedIn) && user.interestedIn.length > 0;
  const range = (user as any).preferredAgeRange || {};
  const hasRange = typeof range.min === "number" && typeof range.max === "number";
  return hasAge && hasGender && hasAvatar && hasIntention && hasInterestedIn && hasRange;
};

const formatLabelValue = (value?: string | number) => {
  if (value === null || typeof value === "undefined" || value === "") return "—";
  return String(value);
};

const normalizeInterestedInValue = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized === "male") return "guys";
  if (normalized === "female") return "girls";
  if (normalized === "nonbinary") return "non-binary";
  return normalized;
};

const formatListValue = (value?: string[]) => {
  if (!value || value.length === 0) return "—";
  return value
    .map((item) => normalizeInterestedInValue(item).replace(/-/g, " "))
    .join(", ");
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

const getActiveUser = (authUser: { username: string; email?: string } | null) => {
  if (authUser?.username) return authUser;
  const stored = getStoredUser();
  if (stored?.username) return { username: stored.username, email: stored.email };
  return null;
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
  const [, setLocation] = useLocation();
  const [authUser, setAuthUser] = useState<{ username: string; email?: string } | null>(null);
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
  const [editImageSecondary, setEditImageSecondary] = useState("");
  const [editPrompts, setEditPrompts] = useState<Record<keyof typeof DEFAULT_PROMPTS, string>>(DEFAULT_PROMPTS);
  const [editInterestedIn, setEditInterestedIn] = useState<string[]>([]);
  const [editIntention, setEditIntention] = useState<string[]>([]);
  const [editPreferredAgeMin, setEditPreferredAgeMin] = useState("");
  const [editPreferredAgeMax, setEditPreferredAgeMax] = useState("");
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const imageInputId = useId();
  const secondaryImageInputId = useId();
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
  const [setupAvatarDataUrl, setSetupAvatarDataUrl] = useState("");
  const [setupAvatarName, setSetupAvatarName] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    ageMin: 18,
    ageMax: 65,
    intention: "all",
    interestedInYou: false,
    matchedWith: false,
  });

  const resolveAuthUser = async () => {
    const active = getActiveUser(authUser);
    if (active?.username) {
      if (!authUser) setAuthUser(active);
      return active;
    }
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (!response.ok) return null;
      const user = await response.json().catch(() => null);
      if (user?.username) {
        setAuthUser(user);
        localStorage.setItem("meetCuteUser", JSON.stringify(user));
        return user;
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  };

  useEffect(() => {
    let cancelled = false;
    const ensureUser = async () => {
      const stored = await resolveAuthUser();
      if (!stored?.username) {
        if (!cancelled) setLocation("/login");
        return null;
      }
      return stored;
    };

    const loadUsers = async () => {
      if (cancelled) return;
      const stored = await ensureUser();
      if (!stored?.username) return;
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
          fetch(`/api/users/${encodeURIComponent(stored.username)}`, { credentials: "include" }),
          fetch(`/api/users?${params.toString()}`, { credentials: "include" }),
        ]);

        if (meResponse.ok) {
          const meUser = (await meResponse.json()) as ApiUser;
          setShowSetupModal(!isProfileComplete(meUser));
          const template = pickSeedProfile(stored.username, 0);
          setCurrentUserProfile({
            id: stored.username,
            name: stored.username,
            description: "This is you.",
            image: meUser.avatar || template?.image || "",
            imageSecondary: meUser.avatarSecondary || "",
            age: meUser.age,
            gender: meUser.gender,
            interestedIn: meUser.interestedIn,
            intention: meUser.intention,
            preferredAgeRange: meUser.preferredAgeRange,
            prompts: mergePrompts(meUser.prompts),
          });
        } else {
          setShowSetupModal(true);
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
                  imageSecondary: user.avatarSecondary || "",
                  age: user.age,
                  gender: user.gender,
                  interestedIn: user.interestedIn,
                  intention: user.intention,
                  preferredAgeRange: user.preferredAgeRange,
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
        setShowSetupModal(true);
      }
    };

    if (showSetupModal || isFullScreen || selectedProfile) {
      return () => {
        cancelled = true;
      };
    }

    loadUsers();
    const interval = setInterval(loadUsers, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [filters, showSetupModal, isFullScreen, selectedProfile, authUser]);

  useEffect(() => {
    if (!selectedProfile) return;
    const currentId = currentUserProfile?.id || "you";
    if (selectedProfile.id === currentId) {
      setEditImage(selectedProfile.image || "");
      setEditImageSecondary(selectedProfile.imageSecondary || "");
      setEditPrompts(mergePrompts(selectedProfile.prompts));
      setEditInterestedIn(selectedProfile.interestedIn || []);
      setEditIntention((selectedProfile as any).intention || []);
      setEditPreferredAgeMin(
        typeof selectedProfile.preferredAgeRange?.min === "number"
          ? String(selectedProfile.preferredAgeRange.min)
          : ""
      );
      setEditPreferredAgeMax(
        typeof selectedProfile.preferredAgeRange?.max === "number"
          ? String(selectedProfile.preferredAgeRange.max)
          : ""
      );
    }
    setIsEditingProfile(false);
    setProfileSaveError(null);
  }, [selectedProfile, currentUserProfile]);

  const handleSetupComplete = async () => {
    if (!setupData.age || setupData.intention.length === 0 || !setupData.identification || setupData.interestedIn.length === 0 || !setupData.preferredAgeMin || !setupData.preferredAgeMax) {
      alert("Please fill in all fields");
      return;
    }
    if (!setupAvatarDataUrl) {
      setSetupError("Please upload a profile photo to continue.");
      return;
    }
    // Save setup data with user-specific key
    const storedUser = localStorage.getItem("meetCuteUser");
    const setupKey = `meetCuteUserSetup_${storedUser}`;
    localStorage.setItem(setupKey, JSON.stringify(setupData));
    // Also save a flag that setup is complete
    localStorage.setItem("meetCuteUserSetup", "true");

    const stored = getActiveUser(authUser);
    if (stored?.username) {
      try {
        const updatedFields = {
          age: Number(setupData.age),
          gender: setupData.identification,
          interestedIn: setupData.interestedIn,
        };
        const response = await fetch(`/api/users/${encodeURIComponent(stored.username)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            age: updatedFields.age,
            gender: updatedFields.gender,
            intention: setupData.intention,
            interestedIn: updatedFields.interestedIn,
            avatar: setupAvatarDataUrl,
            preferredAgeRange: {
              min: Number(setupData.preferredAgeMin),
              max: Number(setupData.preferredAgeMax),
            },
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setSetupError(payload?.error || "Unable to save profile. Please try again.");
          return;
        }
        const nextImage = payload.avatar || setupAvatarDataUrl;
        setCurrentUserProfile((prev) =>
          prev ? { ...prev, ...updatedFields, image: nextImage } : prev
        );
        setSelectedProfile((prev) =>
          prev && prev.id === stored.username ? { ...prev, ...updatedFields, image: nextImage } : prev
        );
        setShowSetupModal(false);
        setSetupError(null);
      } catch (err) {
        console.error(err);
        setSetupError("Unable to save profile. Please try again.");
      }
      return;
    }
    setShowSetupModal(false);
    setSetupError(null);
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

  const handleSetupAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSetupError(null);
    compressImageToDataUrl(file)
      .then((result) => {
        setSetupAvatarDataUrl(result);
        setSetupAvatarName(file.name);
        setSetupError(null);
      })
      .catch((err) => {
        console.error(err);
        setSetupAvatarDataUrl("");
        setSetupAvatarName("");
        setSetupError(err?.message || "Unable to process the image. Please try another photo.");
      });
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

  const toggleLike = async (profileId: string) => {
    const stored = getActiveUser(authUser);
    if (!stored?.username) return;
    const wasLiked = likedProfiles.has(profileId);
    const prevLiked = new Set(likedProfiles);
    const prevProfiles = profiles;

    const nextLiked = new Set(likedProfiles);
    if (wasLiked) {
      nextLiked.delete(profileId);
    } else {
      nextLiked.add(profileId);
    }
    setLikedProfiles(nextLiked);
    setProfiles((prev) =>
      prev.map((profile) => {
        if (profile.id !== profileId) return profile;
        const likedByYou = !wasLiked;
        const matchStatus = likedByYou && profile.likedYou ? "matched" : likedByYou ? "liked" : "default";
        return { ...profile, likedByYou, matchStatus };
      })
    );

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(profileId)}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: wasLiked ? "unlike" : "like" }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setLikedProfiles(prevLiked);
        setProfiles(prevProfiles);
        setProfilesError(payload?.error || "Unable to like user.");
        return;
      }
    } catch (err) {
      console.error(err);
      setLikedProfiles(prevLiked);
      setProfiles(prevProfiles);
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

  const readImageFile = (file: File, onLoad: (dataUrl: string) => void) => {
    setProfileSaveError(null);
    compressImageToDataUrl(file)
      .then(onLoad)
      .catch((err) => {
        console.error(err);
        setProfileSaveError(err?.message || "Unable to process the image. Please try another photo.");
      });
  };

  const handleSaveProfile = async () => {
    const stored = getActiveUser(authUser);
    if (!stored?.username) return;
    setIsSavingProfile(true);
    setProfileSaveError(null);
    try {
      const minRange = Number(editPreferredAgeMin);
      const maxRange = Number(editPreferredAgeMax);
      const hasRange = !Number.isNaN(minRange) && !Number.isNaN(maxRange);
      const updatePayload = {
        avatar: editImage,
        intention: editIntention,
        interestedIn: editInterestedIn,
        prompts: editPrompts,
        ...(hasRange ? { preferredAgeRange: { min: minRange, max: maxRange } } : {}),
      };
      const response = await fetch(`/api/users/${encodeURIComponent(stored.username)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updatePayload),
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
        interestedIn: payload.interestedIn ?? editInterestedIn ?? activeCurrentUser.interestedIn,
        intention: payload.intention ?? editIntention ?? (activeCurrentUser as any).intention,
        preferredAgeRange: hasRange ? { min: minRange, max: maxRange } : activeCurrentUser.preferredAgeRange,
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

  const handleImageUpload = async (dataUrl: string, kind: "primary" | "secondary") => {
    const stored = getActiveUser(authUser);
    if (!stored?.username) return;
    setProfileSaveError(null);
    try {
      const endpoint =
        kind === "secondary" ? "avatar-secondary" : "avatar";
      const body =
        kind === "secondary" ? { avatarSecondary: dataUrl } : { avatar: dataUrl };
      const response = await fetch(`/api/users/${encodeURIComponent(stored.username)}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          payload?.error ||
          (response.status === 413
            ? "Image is too large. Please upload a smaller PNG or JPEG."
            : `Upload failed (${response.status}). Please try again.`);
        setProfileSaveError(message);
        return;
      }
      if (kind === "secondary") {
        const nextImage = payload.avatarSecondary || dataUrl;
        setEditImageSecondary(nextImage);
        setCurrentUserProfile((prev) => (prev ? { ...prev, imageSecondary: nextImage } : prev));
        setSelectedProfile((prev) =>
          prev && prev.id === stored.username ? { ...prev, imageSecondary: nextImage } : prev
        );
      } else {
        const nextImage = payload.avatar || dataUrl;
        setEditImage(nextImage);
        setCurrentUserProfile((prev) => (prev ? { ...prev, image: nextImage } : prev));
        setSelectedProfile((prev) =>
          prev && prev.id === stored.username ? { ...prev, image: nextImage } : prev
        );
      }
    } catch (err) {
      console.error(err);
      setProfileSaveError("Unable to upload image. Please check your connection and try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (err) {
      console.error(err);
    } finally {
      const stored = getStoredUser();
      if (stored?.raw) {
        localStorage.removeItem("meetCuteUser");
        localStorage.removeItem("meetCuteUserSetup");
        localStorage.removeItem(`meetCuteUserSetup_${stored.raw}`);
      }
      setLocation("/login");
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

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-8 h-8 text-foreground hover:text-primary transition-colors"
              title="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
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

              {/* Profile Photo */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-foreground font-body">Profile Photo</label>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 border-2 border-black bg-muted/30 flex items-center justify-center overflow-hidden">
                    {setupAvatarDataUrl ? (
                      <img
                        src={setupAvatarDataUrl}
                        alt="Profile preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground font-body">Upload</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <input
                      id="setup-avatar"
                      type="file"
                      accept="image/*"
                      onChange={handleSetupAvatarChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="setup-avatar"
                      className="inline-flex items-center justify-center w-full border-2 border-black rounded-none font-body text-sm py-2 px-3 bg-background cursor-pointer hover:bg-muted/30"
                    >
                      Choose a photo
                    </label>
                    <p className="text-xs text-muted-foreground font-body">
                      PNG or JPEG{setupAvatarName ? ` · ${setupAvatarName}` : ""}.
                    </p>
                  </div>
                </div>
              </div>

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
                  {["Girls", "Guys", "Non-binary"].map((option) => (
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
              {setupError && (
                <p className="text-sm text-red-600 font-body" role="alert">
                  {setupError}
                </p>
              )}
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
                {selectedProfile.id === activeCurrentUser.id && (
                  <>
                    <input
                      id={imageInputId}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0];
                        if (!file) return;
                        setProfileSaveError(null);
                        readImageFile(file, (result) => {
                          setIsEditingProfile(true);
                          handleImageUpload(result, "primary");
                        });
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor={imageInputId}
                      className="absolute bottom-3 right-3 flex items-center justify-center w-10 h-10 rounded-full bg-background/90 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:scale-105 transition-transform"
                      title="Edit image"
                    >
                      <ImagePlus className="h-5 w-5 text-foreground" />
                    </label>
                  </>
                )}
              </div>

              {/* Profile Details */}
              <div className="p-6 space-y-6">
                {/* Profile Info */}
                <div className="space-y-3">
                  <h2 className="font-display text-2xl text-foreground">{selectedProfile.name}</h2>
                  {isEditingProfile && selectedProfile.id === activeCurrentUser.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-body mb-1">
                            Looking for
                          </label>
                          <div className="space-y-2">
                            {["dating", "friendship"].map((option) => (
                              <label key={option} className="flex items-center gap-2 text-sm font-body">
                                <Checkbox
                                  checked={editIntention.includes(option)}
                                  onCheckedChange={() =>
                                    setEditIntention((prev) =>
                                      prev.includes(option)
                                        ? prev.filter((item) => item !== option)
                                        : [...prev, option]
                                    )
                                  }
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
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
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-body mb-1">
                            Preferred age range
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Input
                                type="number"
                                min="18"
                                max="100"
                                placeholder="Min"
                                value={editPreferredAgeMin}
                                onChange={(e) => setEditPreferredAgeMin(e.target.value)}
                                className="w-full border-2 border-black rounded-none font-body text-sm"
                              />
                            </div>
                            <div>
                              <Input
                                type="number"
                                min="18"
                                max="100"
                                placeholder="Max"
                                value={editPreferredAgeMax}
                                onChange={(e) => setEditPreferredAgeMax(e.target.value)}
                                className="w-full border-2 border-black rounded-none font-body text-sm"
                              />
                            </div>
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
                      <span className="inline-flex items-center bg-muted/30 border-2 border-black px-3 py-1 text-xs font-bold uppercase tracking-wider">
                        Looking for: {formatListValue((selectedProfile as any).intention)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Second Image */}
                <div className="w-full aspect-square bg-gradient-to-br from-muted to-muted/20 relative overflow-hidden flex items-center justify-center border-2 border-black">
                  {selectedProfile.imageSecondary ? (
                    <img
                      src={
                        isEditingProfile && selectedProfile.id === activeCurrentUser.id
                          ? editImageSecondary || selectedProfile.imageSecondary
                          : selectedProfile.imageSecondary
                      }
                      alt="Secondary profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground font-body">No second image yet</p>
                  )}
                  {selectedProfile.id === activeCurrentUser.id && (
                    <>
                      <input
                        id={secondaryImageInputId}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          if (!file) return;
                          setProfileSaveError(null);
                          readImageFile(file, (result) => {
                            setIsEditingProfile(true);
                            handleImageUpload(result, "secondary");
                          });
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor={secondaryImageInputId}
                        className="absolute bottom-3 right-3 flex items-center justify-center w-10 h-10 rounded-full bg-background/90 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:scale-105 transition-transform"
                        title="Edit second image"
                      >
                        <ImagePlus className="h-5 w-5 text-foreground" />
                      </label>
                    </>
                  )}
                </div>

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
                          placeholder={PROMPT_PLACEHOLDER}
                        />
                      ) : (
                        <p className="text-base text-foreground font-body">
                          {mergePrompts(selectedProfile.prompts)[key] || PROMPT_PLACEHOLDER}
                        </p>
                      )}
                    </div>
                  ))}

                  {profileSaveError && (
                    <p className="text-sm text-red-600 font-body">{profileSaveError}</p>
                  )}
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
                        setEditImageSecondary(selectedProfile.imageSecondary || "");
                        setEditPrompts(mergePrompts(selectedProfile.prompts));
                        setEditInterestedIn(selectedProfile.interestedIn || []);
                        setEditIntention((selectedProfile as any).intention || []);
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
