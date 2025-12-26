export interface ShopAvatarItem {
  id: string;
  name: string;
  image: string;
  price: number;
  type: 'avatar';
  description: string;
}

export const SHOP_AVATARS: ShopAvatarItem[] = [
  {
    id: 'avatar1',
    name: 'Astronaut',
    image: '/images/Astronaut.png',
    price: 100,
    type: 'avatar',
    description: 'Suit up with this calm astronaut portrait crafted from your upload for a premium profile.'
  },
  {
    id: 'avatarDragon',
    name: 'Dragon Head',
    image: '/images/Dragon.png',
    price: 200,
    type: 'avatar',
    description: 'Lead with your fiercest side—this dragon head is rendered from the image you provided.'
  },
  {
    id: 'avatar2',
    name: 'Gallery Shoot',
    image: '/images/we09532.png',
    price: 180,
    type: 'avatar',
    description: 'Showcase your candid fitness energy with natural lighting that highlights the real you.'
  },
  {
    id: 'avatar3',
    name: 'Clan of the Flame',
    image: '/images/ChatGPT_Image_Clan_Of_27_Fire.png',
    price: 250,
    type: 'avatar',
    description: 'Your submitted flame portrait preserved in full color so your story shines through.'
  },
  {
    id: 'avatar4',
    name: 'FitBuddy Portrait',
    image: '/images/fitbuddy_head.png',
    price: 160,
    type: 'avatar',
    description: 'Our brand face filtered with your premium vibe so the FitBuddy look stays sharp.'
  },
  {
    id: 'avatar5',
    name: 'Neon Ninja',
    image: '/images/Neon.png',
    price: 210,
    type: 'avatar',
    description: 'Stay stealthy with this neon ninja portrait built from your glowing PNG.'
  },
  {
    id: 'avatar6',
    name: 'FitBuddy Favicon',
    image: '/images/fitbuddy_favicon.png',
    price: 90,
    type: 'avatar',
    description: 'A polished badge-sized portrait that keeps the FitBuddy vibe tight in compact spaces.'
  },
  {
    id: 'avatar7',
    name: 'Shiba Inu',
    image: '/images/Dog.png',
    price: 80,
    type: 'avatar',
    description: 'Let this shiba-inspired portrait add a playful wink to your profile.'
  },
  {
    id: 'avatar8',
    name: 'Ninja',
    image: '/images/Ninja.png',
    price: 300,
    type: 'avatar',
    description: 'A stealthy ninja portrait using the custom PNG you added.'
  },
  {
    id: 'avatar9',
    name: 'AI Robot',
    image: '/images/AI.png',
    price: 110,
    type: 'avatar',
    description: 'A sleek AI-ready portrait that mirrors the futurism of your uploaded art.'
  },
  {
    id: 'avatar10',
    name: 'Pirate',
    image: '/images/Pirate.png',
    price: 210,
    type: 'avatar',
    description: 'Set sail with this bold pirate portrait that brings your adventurous side to the forefront.'
  },
  {
    id: 'avatar11',
    name: 'Cowboy',
    image: '/images/Cowboy.png',
    price: 130,
    type: 'avatar',
    description: 'Channel rugged determination with this cowboy portrait made from your custom art.'
  },
  {
    id: 'avatar12',
    name: 'Glade Whisper',
    image: 'https://api.dicebear.com/7.x/bottts/svg?seed=GladeWhisper',
    price: 140,
    type: 'avatar',
    description: 'A soft forest spirit to keep your gallery balanced and peaceful.'
  }
];
