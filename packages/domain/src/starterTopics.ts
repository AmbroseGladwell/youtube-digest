export interface StarterTopic {
  name: string;
  description: string;
  // "What you're focusing on" opens with these for the topics a reader picked (design 141h),
  // and example is the "Your own" field's hint for that group.
  suggestions: readonly string[];
  example: string;
}

// The topics onboarding offers, in the order it shows them (docs/features/onboarding.md). A
// description says what a topic includes, never what it leaves out: a reader picks only some
// of them, and an overview can sit under several.
export const STARTER_TOPICS: readonly StarterTopic[] = [
  { name: "AI", description: "Artificial intelligence, including automation.", suggestions: ["using AI at work", "building with AI"], example: "an AI assistant" },
  { name: "Tech", description: "Computers, gadgets, software and the internet.", suggestions: ["tech products", "coding"], example: "an app" },
  { name: "Productivity", description: "Getting things done, including habits, focus and planning.", suggestions: ["better habits", "staying focused"], example: "an early morning routine" },
  { name: "Career", description: "Jobs and working life, including leadership.", suggestions: ["a career change", "a promotion"], example: "my first management job" },
  { name: "Business", description: "Building and running a business, including marketing.", suggestions: ["starting a business", "a side project"], example: "a café" },
  { name: "Finance", description: "Personal money and markets, including investing and crypto.", suggestions: ["money", "investing"], example: "paying off debt" },
  { name: "Health", description: "Your body's wellbeing, including nutrition, sleep and medicine.", suggestions: ["sleep", "eating better"], example: "lower blood pressure" },
  { name: "Fitness", description: "Exercise and training.", suggestions: ["getting stronger", "running further"], example: "a half marathon" },
  { name: "Psychology", description: "How people think and feel, including mindfulness and relationships.", suggestions: ["managing stress", "my relationships"], example: "being more patient" },
  { name: "Philosophy", description: "Big questions about how to live and what is true.", suggestions: ["how to live well", "thinking clearly"], example: "reading the Stoics" },
  { name: "Education", description: "Learning and teaching, including languages.", suggestions: ["languages", "exams"], example: "learning Spanish" },
  { name: "Science", description: "How the world works, including climate.", suggestions: ["understanding climate", "how things work"], example: "astronomy" },
  { name: "Nature", description: "Animals, plants and the outdoors.", suggestions: ["getting outdoors", "wildlife"], example: "birdwatching" },
  { name: "History", description: "The past and how it shaped today.", suggestions: ["understanding the past", "family history"], example: "the Romans" },
  { name: "Politics", description: "Government and public life, including economics.", suggestions: ["following the news", "understanding economics"], example: "local elections" },
  { name: "Food", description: "Cooking, recipes and eating well.", suggestions: ["new recipes", "family meals"], example: "baking" },
  { name: "Home", description: "Your home, including gardening and DIY.", suggestions: ["a home project", "the garden"], example: "a loft conversion" },
  { name: "Parenting", description: "Raising children.", suggestions: ["raising kids", "a new baby"], example: "the teenage years" },
  { name: "Fashion", description: "Clothes, style and grooming.", suggestions: ["finding my style", "dressing better"], example: "a capsule wardrobe" },
  { name: "Design", description: "Visual craft, including art, drawing and photography.", suggestions: ["drawing", "photography"], example: "watercolours" },
  { name: "Writing", description: "Writing well, from stories to emails.", suggestions: ["writing better", "finishing a book"], example: "a newsletter" },
  { name: "Music", description: "Listening to, playing and making music.", suggestions: ["learning an instrument", "making music"], example: "the guitar" },
  { name: "Books", description: "Books, reading and authors.", suggestions: ["reading more", "a book club"], example: "the classics" },
  { name: "Film", description: "Films, including TV.", suggestions: ["making films", "watching better films"], example: "screenwriting" },
  { name: "Gaming", description: "Video games and board games.", suggestions: ["getting better at a game", "making a game"], example: "chess" },
  { name: "Sport", description: "Playing and watching sport.", suggestions: ["a sport I play", "coaching a team"], example: "my tennis serve" },
  { name: "Travel", description: "Places to go and how to get there.", suggestions: ["planning a trip", "travelling cheaply"], example: "a year abroad" },
];
