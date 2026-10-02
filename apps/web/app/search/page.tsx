import { SemanticSearchExplorer } from "@/features/search/semantic-search-explorer";

export const metadata = {
  title: "Semantic KB Explorer - Creative Research Workbench",
  description: "Explore research documents across your knowledge base using hybrid semantic search and filters.",
};

export default function SearchPage() {
  return <SemanticSearchExplorer />;
}
