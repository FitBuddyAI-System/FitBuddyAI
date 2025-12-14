import React, { useEffect, useMemo, useState } from 'react';
import { Flame, Check } from 'lucide-react';
import BackgroundDots from './BackgroundDots';
import './AchievementsPage.css';
import { loadUserData, saveUserData } from '../services/localStorage';

const PROGRESS_STROKE_WIDTH = 5;
const PROGRESS_VIEWBOX_SIZE = 80;
const PROGRESS_CENTER = PROGRESS_VIEWBOX_SIZE / 2;
const PROGRESS_RADIUS = PROGRESS_CENTER - PROGRESS_STROKE_WIDTH;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

const achievements = [
  {
    label: '1-Day Spark',
    days: 1,
    description: 'You showed up for day one—momentum begins here.',
    level: 'level-0',
    reward: '+10 Energy',
    energyReward: 10
  },
  {
    label: 'One-Week Streak',
    days: 7,
    description: 'You kept the ember lit for a full week—momentum unlocked.',
    level: 'level-1',
    reward: '+100 Energy + Ember Badge',
    energyReward: 100,
    durationLabel: '1 week'
  },
  {
    label: 'Two-Week Streak',
    days: 14,
    description: 'Two weeks of focus stoked the flame brighter.',
    level: 'level-2',
    reward: '+250 Energy + Flame Ring Frame',
    energyReward: 250,
    durationLabel: '2 weeks'
  },
  {
    label: 'Three-Week Streak',
    days: 21,
    description: 'Three weeks of dedication blazes into legend status.',
    level: 'level-3',
    reward: '+500 Energy + Legendary Flame',
    energyReward: 500,
    durationLabel: '3 weeks'
  }
  ,
  {
    label: '1-Month Blaze',
    days: 30,
    description: 'A full month of consistency turns your fire into a beacon.',
    level: 'level-4',
    reward: '+700 Energy + Inferno Emblem',
    energyReward: 700,
    durationLabel: '1 month'
  }
  ,
  {
    label: '3-Month Apex',
    days: 90,
    description: 'Three months of streaks forge a legendary flame that lights the room.',
    level: 'level-5',
    reward: '+1500 Energy + Phoenix Crest',
    energyReward: 1500,
    durationLabel: '3 months'
  }
  ,
  {
    label: 'One-Year Beacon',
    days: 365,
    description: 'A full year of streaks causes your fire to become a blazing beacon of dedication.',
    level: 'level-6',
    reward: '+3000 Energy + Beacon of Fire',
    energyReward: 3000,
    durationLabel: '1 year'
  }
  ,
  {
    label: 'Three-Year Eternity',
    days: 1095,
    description: 'Three years of relentless streaks make your flame eternal and unstoppable.',
    level: 'level-7',
    reward: '+6000 Energy + Eternity Flame',
    energyReward: 6000,
    durationLabel: '3 years'
  }
  ,
  {
    label: 'Decade Legacy',
    days: 3650,
    description: 'A decade of consistency turns your fire into a guiding legacy for every future streak.',
    level: 'level-8',
    reward: '+50000 Energy + Legacy Radiance',
    energyReward: 50000,
    durationLabel: '10 years'
  }
];

const AchievementsPage: React.FC = () => {
  const normalizeUser = () => {
    const user = loadUserData();
    return user || null;
  };

  const getStreakFromUser = (candidate: any) => {
    if (!candidate) return 0;
    return (candidate?.streak ?? candidate?.streakCount ?? 0);
  };

  const [user, setUser] = useState<any>(() => normalizeUser());
  const [currentStreak, setCurrentStreak] = useState(() => getStreakFromUser(normalizeUser()));

  useEffect(() => {
    const handleStorage = () => {
      const latest = normalizeUser();
      setUser(latest);
      setCurrentStreak(getStreakFromUser(latest));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (!user) return;
    const earnedArray = Array.isArray(user.achievementsEarned) ? user.achievementsEarned : [];
    const earnedSet = new Set(earnedArray);
    let energyDelta = 0;

    const removals = achievements.filter((achievement) => earnedSet.has(achievement.label) && currentStreak < achievement.days);
    removals.forEach((achievement) => {
      earnedSet.delete(achievement.label);
      energyDelta -= achievement.energyReward ?? 0;
    });

    const additions = achievements.filter((achievement) => !earnedSet.has(achievement.label) && currentStreak >= achievement.days);
    additions.forEach((achievement) => {
      earnedSet.add(achievement.label);
      energyDelta += achievement.energyReward ?? 0;
    });

    if (!removals.length && !additions.length) return;

    const nextUser = {
      ...user,
      energy: Math.max(0, (user.energy ?? 0) + energyDelta),
      achievementsEarned: Array.from(earnedSet)
    };
    saveUserData({ data: nextUser });
    try { window.dispatchEvent(new Event('storage')); } catch {}
    try { window.dispatchEvent(new CustomEvent('fitbuddyai-user-updated', { detail: nextUser })); } catch {}
    setUser(nextUser);
  }, [currentStreak, user]);

  const streakLabel = useMemo(() => {
    if (currentStreak <= 1) return `${currentStreak} day`;
    return `${currentStreak} days`;
  }, [currentStreak]);

  return (
    <div className="page-with-dots achievements-page">
      <BackgroundDots />
      <div className="achievements-content">
        <header className="achievements-hero">
          <p className="eyebrow">Achievements</p>
          <h1>Let your streaks glow</h1>
          <p>Every workout threads a new spark. The more days you stack, the brighter your flame grows.</p>
          <div className="achievements-current-streak">
            <span>Current streak</span>
            <strong>{streakLabel}</strong>
          </div>
        </header>
      <div className="achievement-grid">
        {achievements.map(({ label, days, reward, level, durationLabel }) => {
          const progress = Math.min(1, currentStreak / Math.max(1, days));
          const completed = currentStreak >= days;
          const progressOffset = PROGRESS_CIRCUMFERENCE - progress * PROGRESS_CIRCUMFERENCE;
          const durationText = durationLabel ?? `${days}-Day streak`;
          return (
            <article key={label} className={`achievement-card ${level}`}>
              <div
                className="flame-wrapper"
                aria-label={`${label} progress ${Math.round(progress * 100)}%`}
              >
                <svg
                  className="flame-progress-ring"
                  viewBox={`0 0 ${PROGRESS_VIEWBOX_SIZE} ${PROGRESS_VIEWBOX_SIZE}`}
                  aria-hidden="true"
                >
                  <circle
                    className="flame-progress-track"
                    cx={PROGRESS_CENTER}
                    cy={PROGRESS_CENTER}
                    r={PROGRESS_RADIUS}
                    strokeWidth={PROGRESS_STROKE_WIDTH}
                  />
                  <circle
                    className="flame-progress-fill"
                    cx={PROGRESS_CENTER}
                    cy={PROGRESS_CENTER}
                    r={PROGRESS_RADIUS}
                    strokeWidth={PROGRESS_STROKE_WIDTH}
                    strokeDasharray={PROGRESS_CIRCUMFERENCE}
                    strokeDashoffset={progressOffset}
                  />
                </svg>
                <Flame size={48} className="flame-icon" />
                {completed && <Check size={20} className="flame-check" aria-hidden="true" />}
              </div>
              <p className="achievement-streak-length">{durationText}</p>
              <p className="achievement-boost">{reward}</p>
            </article>
          );
        })}
      </div>
      <p className="achievement-note">Keep stacking streaks to crank your flame brightness and unlock new perks.</p>
    </div>
  </div>
);

};

export default AchievementsPage;
