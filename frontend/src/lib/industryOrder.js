// Display order shared by the homepage and full industry directory.
// Original entries, labels, descriptions, and URLs are not modified.
const order = [
  "poultry",
  "piggery",
  "goatery",
  "dairy",
  "agriculture-agribusiness",
  "fisheries-aquaculture",
  "food-processing",
  "handloom-textiles",
  "rural-enterprises",
  "producer-institutions",
];
const rank = new Map(order.map((slug, index) => [slug, index]));
export function orderedIndustries(items = []) {
  return [...items].sort((a, b) =>
    (rank.get(a.slug) ?? order.length) - (rank.get(b.slug) ?? order.length)
  );
}
