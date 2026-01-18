export interface Profile {
  id: number;
  name: string;
  title: string;
  description: string;
  image: string;
}

export const currentUser: Profile = {
  id: 0,
  name: "You",
  title: "Center of the Universe",
  description: "The focal point of this vibrant network.",
  image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop"
};

export const profiles: Profile[] = [
  {
    id: 1,
    name: "Alex Rivera",
    title: "UX Designer",
    description: "Crafting intuitive digital experiences with a focus on accessibility.",
    image: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=400&h=400&fit=crop"
  },
  {
    id: 2,
    name: "Sarah Chen",
    title: "Product Manager",
    description: "Turning chaotic ideas into structured roadmaps and shipped products.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop"
  },
  {
    id: 3,
    name: "Marcus Johnson",
    title: "Frontend Dev",
    description: "Pixel perfectionist who loves React and clean code.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop"
  },
  {
    id: 4,
    name: "Emily Davis",
    title: "Data Scientist",
    description: "Finding stories hidden within complex datasets.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop"
  },
  {
    id: 5,
    name: "David Kim",
    title: "Cloud Architect",
    description: "Building scalable infrastructure in the sky.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop"
  },
  {
    id: 6,
    name: "Jessica Lee",
    title: "Marketing Lead",
    description: "Connecting brands with people through authentic storytelling.",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop"
  },
  {
    id: 7,
    name: "Michael Brown",
    title: "Sales Director",
    description: "Building relationships and driving growth.",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop"
  },
  {
    id: 8,
    name: "Olivia Wilson",
    title: "Content Strategist",
    description: "Wordsmithing the future of digital communication.",
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop"
  },
  {
    id: 9,
    name: "Daniel Martinez",
    title: "DevOps Engineer",
    description: "Automating everything that moves.",
    image: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=400&h=400&fit=crop"
  },
  {
    id: 10,
    name: "Sophia Anderson",
    title: "HR Specialist",
    description: "Cultivating a positive and inclusive workplace culture.",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop"
  },
  {
    id: 11,
    name: "James Thomas",
    title: "Financial Analyst",
    description: "Making sense of numbers to guide strategic decisions.",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop"
  },
  {
    id: 12,
    name: "Isabella Taylor",
    title: "Graphic Designer",
    description: "Visualizing ideas with color, typography, and layout.",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop"
  },
  {
    id: 13,
    name: "William Moore",
    title: "Project Manager",
    description: "Keeping the team on track and the stakeholders happy.",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop"
  },
  {
    id: 14,
    name: "Mia Jackson",
    title: "Social Media Manager",
    description: "Creating buzz and engaging communities online.",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop"
  },
  {
    id: 15,
    name: "Benjamin White",
    title: "Software Engineer",
    description: "Solving complex problems with elegant code.",
    image: "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=400&h=400&fit=crop"
  },
  {
    id: 16,
    name: "Charlotte Harris",
    title: "Customer Support",
    description: "Helping users succeed one ticket at a time.",
    image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop"
  },
  {
    id: 17,
    name: "Lucas Martin",
    title: "Operations Manager",
    description: "Optimizing processes for maximum efficiency.",
    image: "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=400&h=400&fit=crop"
  },
  {
    id: 18,
    name: "Amelia Thompson",
    title: "Legal Counsel",
    description: "Navigating the legal landscape to protect the company.",
    image: "https://images.unsplash.com/photo-1517365830460-955ce3ccd263?w=400&h=400&fit=crop"
  },
  {
    id: 19,
    name: "Henry Garcia",
    title: "Research Scientist",
    description: "Pushing the boundaries of knowledge and innovation.",
    image: "https://images.unsplash.com/photo-1508341591423-4347099e1f19?w=400&h=400&fit=crop"
  },
  {
    id: 20,
    name: "Evelyn Martinez",
    title: "Event Coordinator",
    description: "Creating memorable experiences for teams and clients.",
    image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop"
  },
  {
    id: 21,
    name: "Jack Robinson",
    title: "Business Analyst",
    description: "Bridging the gap between IT and business needs.",
    image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=400&fit=crop"
  },
  {
    id: 22,
    name: "Harper Clark",
    title: "Recruiter",
    description: "Finding the best talent to join our growing team.",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop"
  },
  {
    id: 23,
    name: "Alexander Rodriguez",
    title: "Systems Admin",
    description: "Keeping the lights on and the servers running.",
    image: "https://images.unsplash.com/photo-1480429370139-e0132c086e2a?w=400&h=400&fit=crop"
  },
  {
    id: 24,
    name: "Ella Lewis",
    title: "Copywriter",
    description: "Crafting compelling copy that converts.",
    image: "https://images.unsplash.com/photo-1535931737580-a99567967ddc?w=400&h=400&fit=crop"
  },
  {
    id: 25,
    name: "Liam Walker",
    title: "QA Engineer",
    description: "Ensuring quality and reliability in every release.",
    image: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&h=400&fit=crop"
  }
];
