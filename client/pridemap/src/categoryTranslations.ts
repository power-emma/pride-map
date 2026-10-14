const CATEGORY_KEYS: Record<string, string> = {
  'Advocacy Resources': 'categories.advocacy',
  'Trans Resources': 'categories.trans',
  'Employment Services': 'categories.employment',
  'Community Organisations': 'categories.community',
  'Healthcare Resources': 'categories.healthcare',
  'Student Resources': 'categories.student',
  'Legal Services': 'categories.legal',
  'Queer Businesses': 'categories.businesses',
  'Queer Nightlife': 'categories.nightlife',
  'Parents and Family Resources': 'categories.family',
  'Housing and Shelter': 'categories.housing',
  'Refugees and Immigrant Resources': 'categories.refugees',
  'Sports and Activity Groups': 'categories.sports',
};

export function translateCategory(category: string, translate: (key: string) => string): string {
  const key = CATEGORY_KEYS[category];
  return key ? translate(key) : category;
}
