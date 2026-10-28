export interface StarterTopic {
  name: string;
  description: string;
}

// The topics onboarding offers, in the order it shows them (docs/features/onboarding.md). A
// description says what a topic includes, never what it leaves out: a reader picks only some
// of them, and an overview can sit under several.
export const STARTER_TOPICS: readonly StarterTopic[] = [
  { name: "AI", description: "Artificial intelligence, including automation." },
  { name: "Tech", description: "Computers, gadgets, software and the internet." },
  { name: "Productivity", description: "Getting things done, including habits, focus and planning." },
  { name: "Career", description: "Jobs and working life, including leadership." },
  { name: "Business", description: "Building and running a business, including marketing." },
  { name: "Finance", description: "Personal money and markets, including investing and crypto." },
  { name: "Health", description: "Your body's wellbeing, including nutrition, sleep and medicine." },
  { name: "Fitness", description: "Exercise and training." },
  { name: "Psychology", description: "How people think and feel, including mindfulness and relationships." },
  { name: "Philosophy", description: "Big questions about how to live and what is true." },
  { name: "Education", description: "Learning and teaching, including languages." },
  { name: "Science", description: "How the world works, including climate." },
  { name: "Nature", description: "Animals, plants and the outdoors." },
  { name: "History", description: "The past and how it shaped today." },
  { name: "Politics", description: "Government and public life, including economics." },
  { name: "Food", description: "Cooking, recipes and eating well." },
  { name: "Home", description: "Your home, including gardening and DIY." },
  { name: "Parenting", description: "Raising children." },
  { name: "Fashion", description: "Clothes, style and grooming." },
  { name: "Design", description: "Visual craft, including art, drawing and photography." },
  { name: "Writing", description: "Writing well, from stories to emails." },
  { name: "Music", description: "Listening to, playing and making music." },
  { name: "Books", description: "Books, reading and authors." },
  { name: "Film", description: "Films, including TV." },
  { name: "Gaming", description: "Video games and board games." },
  { name: "Sport", description: "Playing and watching sport." },
  { name: "Travel", description: "Places to go and how to get there." },
];
