export type Workout = {
  title: string;
  id?: string;
  name?: string;
  images?: string[];
  video?: string;
  featuredVideo?: boolean;
  resources?: Array<{ label: string; url: string }>;
  galleryImages?: string[];
  imageCaptions?: string[];
  difficulty?: string;
  duration?: string;
  exampleNote?: string;
  meta?: Record<string, any>;
  force?: string | null;
  level?: string;
  mechanic?: string | null;
  equipment?: string | string[] | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  category?: string;
  displayDifficulty?: string;
  difficultyClass?: string;
  displayCategory?: string;
  categoryClass?: string;
  searchText?: string;
  categoryKey?: string;
  difficultyKey?: string;
};

const modules = import.meta.glob('../data/exercises/*.json', { eager: true }) as Record<string, { default: Partial<Workout> }>;
const assets = import.meta.glob('../data/exercises/**', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const capitalizeWords = (value?: string) => {
  if (!value) return '';
  return String(value)
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const sanitizeClassName = (value?: string) => {
  if (!value) return 'uncategorized';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'uncategorized';
};

const normalizeCategoryLabel = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const mapLevel = (lvl?: string) => {
  if (!lvl) return 'Varies';
  const value = String(lvl).toLowerCase();
  if (value === 'beginner') return 'Easy';
  if (value === 'intermediate') return 'Medium';
  if (value === 'expert' || value === 'advanced') return 'Hard';
  if (value === 'easy' || value === 'medium' || value === 'moderate' || value === 'hard') {
    if (value === 'moderate') return 'Medium';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return 'Varies';
};

const buildWorkoutLibrary = () => {
  const categoryMap = new Map<string, string>();
  const items = Object.entries(modules).map(([path, mod]) => {
    const data = mod && mod.default;
    if (!data) {
      throw new Error(
        `Invalid module structure for "${path}". Expected an object with a "default" property, but got: ${JSON.stringify(mod)}`
      );
    }
    const title = data.name || data.id || path.split('/').pop()?.replace('.json', '') || 'Unknown';

    const images: string[] = Array.isArray(data.images) ? data.images.map((img: string) => {
      const exactKey = `../data/exercises/${img}`;
      if (assets && assets[exactKey]) return assets[exactKey];
      if (assets) {
        const match = Object.entries(assets).find(([key]) => key.endsWith(`/${img}`) || key.endsWith(img));
        if (match) return match[1];
      }
      try {
        return new URL(`../data/exercises/${img}`, import.meta.url).href;
      } catch {
        return `/data/exercises/${img}`;
      }
    }) : [];

    const displayDifficulty = mapLevel(data.level || data.difficulty);
    const difficultyClass = (displayDifficulty || 'Varies').toLowerCase();
    const displayCategory = data.category ? capitalizeWords(data.category) : '';
    const categoryClass = sanitizeClassName(data.category);
    const primaryMuscles = Array.isArray(data.primaryMuscles) ? data.primaryMuscles.map((muscle: string) => capitalizeWords(String(muscle))) : [];
    const secondaryMuscles = Array.isArray(data.secondaryMuscles) ? data.secondaryMuscles.map((muscle: string) => capitalizeWords(String(muscle))) : [];
    const searchText = [
      title,
      data.exampleNote,
      data.meta?.description,
      primaryMuscles.join(' '),
      secondaryMuscles.join(' '),
      data.displayCategory || data.category,
      Array.isArray(data.instructions) ? data.instructions.join(' ') : ''
    ].filter(Boolean).join(' ').toLowerCase();
    const categoryLabel = (displayCategory && displayCategory.trim())
      || (data.category ? capitalizeWords(String(data.category)) : 'Uncategorized');
    const categoryKey = normalizeCategoryLabel(displayCategory || data.category || 'Uncategorized');
    if (!categoryMap.has(categoryKey)) categoryMap.set(categoryKey, categoryLabel);
    const difficultyKey = (displayDifficulty || '').toLowerCase();

    return {
      title,
      ...data,
      images,
      displayDifficulty,
      difficultyClass,
      displayCategory,
      categoryClass,
      primaryMuscles,
      secondaryMuscles,
      searchText,
      categoryKey,
      difficultyKey
    } as Workout;
  });

  items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  const categoryBuckets = new Map<string, Workout[]>();
  items.forEach((item) => {
    const key = item.categoryKey || 'uncategorized';
    if (!categoryBuckets.has(key)) categoryBuckets.set(key, []);
    categoryBuckets.get(key)!.push(item);
  });

  const categoryEntries = Array.from(categoryMap.entries()).map(([key, label]) => ({ key, label }));
  categoryEntries.sort((a, b) => a.label.localeCompare(b.label));
  const categoryOptions = [{ key: 'all', label: 'All' }, ...categoryEntries];

  return { items, categoryOptions, categoryBuckets };
};

const { items: workoutEntries, categoryOptions, categoryBuckets } = buildWorkoutLibrary();

export const getAllWorkouts = () => workoutEntries;
export const getCategoryOptions = () => categoryOptions;
export const getCategoryBuckets = () => categoryBuckets;
