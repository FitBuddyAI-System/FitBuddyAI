import React, { useState, useEffect, useRef } from 'react';
import './ShopPage.css';
import { fetchUserById, buyShopItem } from '../services/authService';
import { saveUserData } from '../services/localStorage';
import { Dumbbell, Sparkles, Smile, RefreshCw, ShoppingCart, Search, Filter, Flame, ShieldCheck } from 'lucide-react';

// Example shop items
const AVATARS = [
  { id: 'avatar1', name: 'Bot Buddy', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=FitBuddyAI1', price: 100, type: 'avatar', description: 'A friendly robot avatar.' },
  { id: 'avatar2', name: 'Dragon Head', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=DragonHead', price: 200, type: 'avatar', description: 'Unleash your inner dragon!' },
  { id: 'avatar3', name: 'Duolingo Owl', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=Duolingo', price: 250, type: 'avatar', description: 'Inspired by the language learning legend.' },
  { id: 'avatar4', name: 'Neo Cat', image: 'https://api.dicebear.com/7.x/croodles/svg?seed=NeoCat', price: 120, type: 'avatar', description: 'A sleek cyber cat.' },
  { id: 'avatar5', name: 'Mountain Goat', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=Goat', price: 140, type: 'avatar', description: 'Sturdy and sure-footed.' },
  { id: 'avatar6', name: 'Galaxy Fox', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=GalaxyFox', price: 220, type: 'avatar', description: 'Out-of-this-world style.' },
  { id: 'avatar7', name: 'Pixel Pup', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=PixelPup', price: 80, type: 'avatar', description: 'Cute pixel-styled puppy.' },
  { id: 'avatar8', name: 'Samurai', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=Samurai', price: 300, type: 'avatar', description: 'Honor and style.' },
  { id: 'avatar9', name: 'Astronaut', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=Astronaut', price: 260, type: 'avatar', description: 'Reach for the stars.' },
  { id: 'avatar10', name: 'Vintage Robot', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=VintageBot', price: 110, type: 'avatar', description: 'Retro charm.' },
  { id: 'avatar11', name: 'Neon Ninja', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=NeonNinja', price: 210, type: 'avatar', description: 'Stealthy and bright.' },
  { id: 'avatar12', name: 'Forest Sprite', image: 'https://api.dicebear.com/7.x/bottts/svg?seed=ForestSprite', price: 130, type: 'avatar', description: 'Whimsical woodland friend.' },
  { id: 'avatar13', name: 'Forest Sprite', image: '/images/ChatGPT_Image_Clan_Of_27_Fire.png', price: 130, type: 'avatar', description: 'Whimsical woodland friend.' }
];

const STREAK_SAVER_OPTIONS = [
  { id: 'streak-saver-1', name: 'Streak Saver 1x', quantity: 1, price: 1000 },
  { id: 'streak-saver-3', name: 'Streak Saver 3x', quantity: 3, price: 2000 },
  { id: 'streak-saver-5', name: 'Streak Saver 5x', quantity: 5, price: 3000 }
];

const DEFAULT_ENERGY = 10000;

const POWERUPS = [
  { id: 'spinpfp', name: 'Spinning Profile Picture', icon: <RefreshCw size={32} color="#1e90cb" />, price: 300, type: 'powerup', description: 'Make your profile picture spin for 7 days!' },
  { id: 'sparkle', name: 'Sparkle Effect', icon: <Sparkles size={32} color="#ffb347" />, price: 150, type: 'powerup', description: 'Add a sparkle effect to your avatar.' },
  { id: 'smile', name: 'Smile Badge', icon: <Smile size={32} color="#1ecb7b" />, price: 80, type: 'powerup', description: 'Show off your positivity!' },
  { id: 'glow', name: 'Glow Outline', icon: <Sparkles size={32} color="#1ecb7b" />, price: 140, type: 'powerup', description: 'Add a soft glow behind your avatar.' },
  { id: 'confetti', name: 'Confetti Burst', icon: <Sparkles size={32} color="#ffb347" />, price: 220, type: 'powerup', description: 'Celebrate finishes with confetti.' },
  { id: 'badge-pro', name: 'Pro Badge', icon: <Smile size={32} color="#1ecb7b" />, price: 190, type: 'powerup', description: 'Show you are a FitBuddyAI Pro.' },
  { id: 'trail', name: 'Movement Trail', icon: <RefreshCw size={32} color="#1e90cb" />, price: 170, type: 'powerup', description: 'Leave a subtle trail when you move.' },
  { id: 'animated-frames', name: 'Animated Frames', icon: <Sparkles size={32} color="#ffb347" />, price: 250, type: 'powerup', description: 'Frame your avatar with animated borders.' },
  { id: 'voice-chime', name: 'Voice Chime', icon: <Smile size={32} color="#1ecb7b" />, price: 120, type: 'powerup', description: 'Play a chime when you start workouts.' },
  { id: 'seasonal-halo', name: 'Seasonal Halo', icon: <Sparkles size={32} color="#1ecb7b" />, price: 160, type: 'powerup', description: 'A seasonal halo that changes with events.' },
  { id: 'vfx', name: 'VFX Pack', icon: <Sparkles size={32} color="#ffb347" />, price: 320, type: 'powerup', description: 'A bundle of effects for your avatar.' },
  { id: 'status-glow', name: 'Status Glow', icon: <RefreshCw size={32} color="#1e90cb" />, price: 90, type: 'powerup', description: 'Show a small glow if you are active.' }
];


interface ShopPageProps {
  user: any;
  onPurchase: (item: any) => void;
}

const ShopPage: React.FC<ShopPageProps> = ({ user, onPurchase }) => {
  const [selectedTab, setSelectedTab] = useState<'avatars' | 'powerups'>('avatars');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'popular' | 'price-asc' | 'price-desc'>('popular');
  const [preview, setPreview] = useState<any | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const prevEnergyRef = useRef<number | undefined>(undefined);
  const [energyPulse, setEnergyPulse] = useState(false);

  // Poll user from server every 1s if logged in
  useEffect(() => {
    if (!user?.id) return;
    const fetchAndUpdate = async () => {
      const fresh = await fetchUserById(user.id);
      if (fresh) {
        // Update localStorage and force rerender via onPurchase (hacky, but works for now)
        window.dispatchEvent(new Event('storage'));
      }
    };
    // Poll less aggressively than 1s — every 7s is plenty for shop inventory/energy updates.
    // Also avoid polling while page is hidden to reduce background network traffic.
    fetchAndUpdate();
    intervalRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchAndUpdate();
    }, 7000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id]);

  // Move tab indicator when selectedTab changes
  useEffect(()=>{
    const root = tabsRef.current;
    const indicator = indicatorRef.current;
    if (!root || !indicator) return;
    const activeBtn = root.querySelector<HTMLButtonElement>(`button[data-tab="${selectedTab}"]`);
    if (!activeBtn) return;
    const rect = activeBtn.getBoundingClientRect();
    const parentRect = root.getBoundingClientRect();
    const left = rect.left - parentRect.left + root.scrollLeft;
    indicator.style.width = `${rect.width}px`;
    indicator.style.transform = `translateX(${left}px)`;
  }, [selectedTab]);

  // keyboard navigation for tabs (left/right)
  useEffect(()=>{
    const root = tabsRef.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
      e.preventDefault();
      const order = ['avatars','powerups'];
      const idx = order.indexOf(selectedTab);
      let next = idx;
      if (e.key === 'ArrowLeft') next = Math.max(0, idx - 1);
      if (e.key === 'ArrowRight') next = Math.min(order.length - 1, idx + 1);
      if (order[next] && order[next] !== selectedTab) setSelectedTab(order[next] as any);
    };
    root.addEventListener('keydown', onKey as any);
    return ()=> root.removeEventListener('keydown', onKey as any);
  }, [selectedTab]);

  // track energy increases to show a brief pulse
  useEffect(()=>{
    const prev = prevEnergyRef.current ?? user?.energy ?? 0;
    const now = user?.energy ?? 0;
    if (now > prev) {
      setEnergyPulse(true);
      const t = setTimeout(()=>setEnergyPulse(false), 900);
      return ()=> clearTimeout(t);
    }
    prevEnergyRef.current = now;
  }, [user?.energy]);

  const energyFillPercent = Math.min(100, Math.round(((user?.energy||0) / (user?.maxEnergy||DEFAULT_ENERGY)) * 100));
  const energyFillBucket = Math.round(energyFillPercent / 5) * 5; // bucket to nearest 5%
  const energyFillClass = `fill--${energyFillBucket}`;

  // Fetch user after purchase
  const handlePurchase = async (item: any) => {
    if (!user?.id) {
      alert('Please sign in to purchase items.');
      return;
    }
    if (user.energy < item.price) {
      alert('Not enough energy!');
      return;
    }
    setPurchasing(item.id);

    const isStreakSaver = String(item.id || '').startsWith('streak-saver');

    // Handle streak saver client-side to avoid server rejection of custom ids
    if (isStreakSaver) {
      try {
        const qty = Number((item as any).quantity ?? 1);
        let nextInventory = Array.isArray(user.inventory) ? [...user.inventory] : [];
        const idx = nextInventory.findIndex((it: any) => String(it?.id || '').startsWith('streak-saver'));
        if (idx >= 0) {
          const existing = nextInventory[idx];
          const existingQty = Number(existing.quantity ?? existing.count ?? 1);
          nextInventory[idx] = { ...existing, quantity: (Number.isFinite(existingQty) ? existingQty : 1) + qty };
        } else {
          nextInventory.push({ id: 'streak-saver', quantity: qty, type: 'powerup' });
        }
        const nextEnergy = Math.max(0, (user.energy ?? DEFAULT_ENERGY) - item.price);
        const nextUser = { ...user, energy: nextEnergy, inventory: nextInventory };
        saveUserData({ data: nextUser });
        onPurchase(item);
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.warn('Failed to process streak saver purchase:', e);
        alert('Purchase failed.');
      } finally {
        setPurchasing(null);
      }
      return;
    }

    // Default flow for server-backed items
    const updated = await buyShopItem(user.id, item);
    setPurchasing(null);
    if (updated) {
      try {
        let nextInventory = Array.isArray(updated.inventory) ? [...updated.inventory] : (Array.isArray(user.inventory) ? [...user.inventory] : []);
        const nextEnergy = Math.max(0, (updated.energy ?? user.energy) - item.price);
        const nextUser = { ...user, ...updated, energy: nextEnergy, inventory: nextInventory };
        saveUserData({ data: nextUser });
      } catch (e) {
        console.warn('Failed to save user after purchase:', e);
      }
      onPurchase(item);
      window.dispatchEvent(new Event('storage'));
    } else {
      alert('Purchase failed.');
    }
  };

  const filteredItems = (items: any[]) => {
    const q = query.trim().toLowerCase();
    let out = items.filter(it => !q || it.name.toLowerCase().includes(q) || (it.description || '').toLowerCase().includes(q));
    if (sort === 'price-asc') out = out.sort((a,b)=>a.price-b.price);
    if (sort === 'price-desc') out = out.sort((a,b)=>b.price-a.price);
    return out;
  };

  const getInventoryCount = (prefix: string) => {
    const inv = Array.isArray(user?.inventory) ? user.inventory : [];
    return inv.reduce((sum: number, it: any) => {
      if (!it?.id || !String(it.id).startsWith(prefix)) return sum;
      const qty = Number((it as any).quantity ?? (it as any).count ?? 1);
      return sum + (Number.isFinite(qty) ? qty : 1);
    }, 0);
  };

  const streakSaverCount = getInventoryCount('streak-saver');

  return (
    <div className="shop-page fade-in-bounce">
      <div className="shop-header-row">
        <header className="shop-header">
          <Dumbbell size={32} className="shop-logo" />
          <h1 className="shop-title gradient-text">FitBuddyAI Shop</h1>
          <div className="shop-energy">
            <div className={`energy-pill ${energyPulse ? 'pulse' : ''}`} aria-live="polite">
              <span className="energy-value">⚡ {user.energy}</span>
              <div className="energy-meter" aria-hidden>
                <div className={`fill ${energyFillClass}`} />
              </div>
            </div>
          </div>
        </header>
        <aside className="shop-inventory">
          <div className="inventory-header">
            <ShieldCheck size={18} />
            <span>Inventory</span>
          </div>
          <div className="inventory-row">
            <span className="inventory-label">Streak Savers</span>
            <span className="inventory-value">{streakSaverCount}</span>
          </div>
        </aside>
      </div>
      <div className="shop-topbar">
        <div className="shop-tabs" ref={tabsRef} role="tablist" aria-label="Shop categories">
          <div className="tab-indicator" ref={indicatorRef} aria-hidden="true" />
          <button data-tab="avatars" role="tab" aria-pressed={selectedTab === 'avatars'} className={selectedTab === 'avatars' ? 'active' : ''} onClick={() => setSelectedTab('avatars')}>Avatars</button>
          <button data-tab="powerups" role="tab" aria-pressed={selectedTab === 'powerups'} className={selectedTab === 'powerups' ? 'active' : ''} onClick={() => setSelectedTab('powerups')}>Powerups</button>
        </div>
        <div className="shop-controls">
          <div className="search-wrap" role="search">
            <Search size={18} className="icon-muted" />
            <input aria-label="Search shop items" placeholder="Search items" value={query} onChange={e=>setQuery(e.target.value)} />
          </div>
          <div className="sort-wrap">
            <Filter size={16} className="icon-muted" />
            <select aria-label="Sort items" value={sort} onChange={e=>setSort(e.target.value as any)}>
              <option value="popular">Recommended</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Featured banner */}
      <div className="shop-featured">
        <div className="featured-left">
          <Dumbbell size={28} />
          <div>
            <div className="featured-title">Limited-time: Double Energy Sundays</div>
            <div className="featured-desc">Buy selected powerups and receive double energy back for your first workout.</div>
          </div>
        </div>
        <button className="featured-cta">Learn More</button>
      </div>
      <div className="shop-items-grid">
        {selectedTab === 'powerups' && (
          <div className="shop-card streak-saver-card shop-card-span">
            <div className="shop-card-top">
              <div className="shop-powerup-icon streak-saver-icon"><Flame size={36} color="#fff" /></div>
            </div>
            <div className="shop-card-body">
              <h2 className="shop-item-title">Streak Savers</h2>
              <p className="shop-item-desc">Choose a pack to protect your streak on a missed day.</p>
              <div className="streak-saver-options">
                {STREAK_SAVER_OPTIONS.map(opt => {
                  const item = { id: opt.id, name: opt.name, price: opt.price, type: 'powerup', description: `${opt.quantity}x streak saver`, quantity: opt.quantity, icon: <Flame size={24} color="#fb923c" /> };
                  const isBuying = purchasing === opt.id;
                  const disabled = user.energy < opt.price || isBuying;
                  return (
                    <button
                      key={opt.id}
                      className="streak-saver-btn"
                      disabled={disabled}
                      onClick={() => handlePurchase(item)}
                    >
                      <div className="option-title">{opt.quantity}x Saver</div>
                      <div className="option-price">⚡ {opt.price}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {selectedTab === 'avatars' && filteredItems(AVATARS).map(item => {
          const alreadyOwned = Array.isArray(user.inventory) && user.inventory.some((inv: any) => inv.id === item.id);
          return (
            <div className="shop-card" key={item.id} onClick={()=>setPreview(item)}>
              <div className="shop-card-top">
                <img src={item.image} alt={item.name} className="shop-avatar-img" />
              </div>
              <div className="shop-card-body">
                <h2 className="shop-item-title">{item.name} {alreadyOwned && <span className="owned-badge">Owned</span>}</h2>
                <p className="shop-item-desc">{item.description}</p>
                <div className="shop-card-footer">
                  <span className="price-badge">⚡ {item.price}</span>
                  <button
                    className="shop-buy-btn"
                    disabled={alreadyOwned || user.energy < item.price || purchasing === item.id}
                    onClick={(e)=>{ e.stopPropagation(); handlePurchase(item); }}
                  >
                    {alreadyOwned ? 'Owned' : (purchasing === item.id ? 'Buying...' : <><ShoppingCart size={16} /> Buy</>)}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {selectedTab === 'powerups' && filteredItems(POWERUPS).map(item => (
          <div className={`shop-card ${item.id === 'streak-saver' ? 'shop-card-span' : ''}`} key={item.id} onClick={()=>setPreview(item)}>
            <div className="shop-card-top">
              <div className="shop-powerup-icon">{item.icon}</div>
            </div>
            <div className="shop-card-body">
              <h2 className="shop-item-title">{item.name}</h2>
              <p className="shop-item-desc">{item.description}</p>
              <div className="shop-card-footer">
                <span className="price-badge">⚡ {item.price}</span>
                <button
                  className="shop-buy-btn"
                  disabled={user.energy < item.price || purchasing === item.id}
                  onClick={(e)=>{ e.stopPropagation(); handlePurchase(item); }}
                >
                  {purchasing === item.id ? 'Buying...' : <><ShoppingCart size={16} /> Buy</>}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="shop-preview" onClick={()=>setPreview(null)}>
          <div className="preview-card" onClick={(e)=>e.stopPropagation()}>
            <button className="preview-close" onClick={()=>setPreview(null)}>✕</button>
            <div className="preview-body">
              <div className="preview-demo">
                {/* Avatar preview if present */}
                {preview.type === 'avatar' && preview.image && (
                  <img src={preview.image} alt={preview.name} className="preview-img" />
                )}

                {/* Powerup demos mapped by id */}
                {preview.type === 'powerup' && (
                  <div className="powerup-demo">
                    {preview.id === 'spinpfp' && <div className="preview-demo-box spin-anim">⟳</div>}
                    {preview.id === 'sparkle' && <div className="preview-demo-box dots-anim"><span></span><span></span><span></span></div>}
                    {preview.id === 'confetti' && <div className="preview-demo-box confetti-anim">🎉</div>}
                    {preview.id === 'glow' && <div className="preview-demo-box glow-anim">✦</div>}
                    {preview.id === 'trail' && <div className="preview-demo-box trail-anim">➤</div>}
                    {preview.id === 'animated-frames' && <div className="preview-demo-box frames-anim">▦</div>}
                    {preview.id === 'voice-chime' && <div className="preview-demo-box chime-anim">🔔</div>}
                    {preview.id === 'vfx' && <div className="preview-demo-box vfx-anim">✨</div>}
                    {preview.id === 'status-glow' && <div className="preview-demo-box statusglow-anim">●</div>}
                    {/* default fallback */}
                    {!['spinpfp','sparkle','confetti','glow','trail','animated-frames','voice-chime','vfx','status-glow'].includes(preview.id) && (
                      <div className="preview-demo-box">Preview</div>
                    )}
                  </div>
                )}
              </div>

              <h3>{preview.name}</h3>
              <p>{preview.description}</p>
              <div className="preview-actions">
                <span className="price-badge">⚡ {preview.price}</span>
                <div className="preview-actions-row">
                  <button className="shop-buy-btn" onClick={()=>{ handlePurchase(preview); setPreview(null); }}>Buy</button>
                  <button className="shop-buy-btn" onClick={()=>{ 
                    // Try-on: dispatch a custom event that header listens to
                    window.dispatchEvent(new CustomEvent('shop-try-on', { detail: { preview } }));
                  }}>Try On</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopPage;
