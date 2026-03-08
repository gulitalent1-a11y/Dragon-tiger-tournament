/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Wallet, 
  Trophy, 
  Settings, 
  LogOut, 
  MessageSquare, 
  History, 
  ShieldCheck,
  ChevronRight,
  Plus,
  ArrowLeft,
  Users,
  BarChart3,
  Lock
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface UserData {
  id: number;
  username: string;
  wallet_balance: number;
  role: string;
}

interface GameState {
  status: 'betting' | 'dealing' | 'result';
  timer: number;
  dragonCard: any;
  tigerCard: any;
  winner: string | null;
  history: string[];
}

// --- Components ---

const Card = ({ card, label }: { card: any, label: string }) => (
  <div className="flex flex-col items-center gap-2">
    <span className="text-white font-bold uppercase tracking-widest text-sm opacity-60">{label}</span>
    <div className={cn(
      "w-24 h-36 bg-white rounded-lg shadow-xl flex items-center justify-center border-2 transition-all duration-500",
      !card && "bg-opacity-10 border-white/20 border-dashed",
      card && "border-white"
    )}>
      {card ? (
        <div className={cn(
          "flex flex-col items-center",
          (card.suit === 'Hearts' || card.suit === 'Diamonds') ? "text-red-600" : "text-black"
        )}>
          <span className="text-3xl font-bold">{card.value}</span>
          <span className="text-xl">{card.suit === 'Hearts' ? '♥' : card.suit === 'Diamonds' ? '♦' : card.suit === 'Clubs' ? '♣' : '♠'}</span>
        </div>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-red-900/20 to-black/20 rounded-lg flex items-center justify-center">
          <span className="text-white/20 text-4xl font-serif">?</span>
        </div>
      )}
    </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [view, setView] = useState<'auth' | 'lobby' | 'game' | 'admin'>('auth');
  const [gameState, setGameState] = useState<GameState>({
    status: 'betting',
    timer: 15,
    dragonCard: null,
    tigerCard: null,
    winner: null,
    history: []
  });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [myBets, setMyBets] = useState<{ [key: string]: number }>({});

  // Auth States
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', mobile: '', password: '' });

  useEffect(() => {
    if (token) {
      fetchProfile();
      const newSocket = io();
      setSocket(newSocket);
      newSocket.on('game_status', (state) => setGameState(state));
      newSocket.on('timer', (t) => setGameState(prev => ({ ...prev, timer: t })));
      newSocket.on('bet_confirmed', (data) => {
        setUser(prev => prev ? { ...prev, wallet_balance: data.balance } : null);
      });
      newSocket.on('payout_complete', () => {
        fetchProfile();
      });
      return () => { newSocket.close(); };
    } else {
      setView('auth');
    }
  }, [token]);

  const fetchProfile = async () => {
    const res = await fetch('/api/user/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      setView('lobby');
    } else {
      setToken(null);
      localStorage.removeItem('token');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authForm)
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
    } else {
      alert(data.error);
    }
  };

  const placeBet = (side: string) => {
    if (gameState.status !== 'betting') return;
    if (!user || user.wallet_balance < betAmount) return;
    
    socket?.emit('place_bet', { userId: user.id, side, amount: betAmount });
    setMyBets(prev => ({ ...prev, [side]: (prev[side] || 0) + betAmount }));
  };

  useEffect(() => {
    if (gameState.status === 'betting') {
      setMyBets({});
    }
  }, [gameState.status]);

  if (!token || view === 'auth') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans">
        <div className="w-full max-md bg-[#151515] rounded-3xl p-8 border border-white/5 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-red-600 to-red-900 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/20 mb-4 rotate-3">
              <Trophy className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Dragon Tiger</h1>
            <p className="text-white/40 text-sm">Tournament Platform</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <input
                type="text"
                placeholder="Username"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                value={authForm.username}
                onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
              />
            )}
            <input
              type="text"
              placeholder="Mobile Number"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
              value={authForm.mobile}
              onChange={e => setAuthForm({ ...authForm, mobile: e.target.value })}
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
              value={authForm.password}
              onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
            />
            <button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-red-900/20 active:scale-95">
              {authMode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-white/40 text-sm hover:text-white transition-colors"
            >
              {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/20">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-sm leading-tight">Dragon Tiger</h2>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Tournament</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-white/5 rounded-full pl-3 pr-1 py-1 flex items-center gap-3 border border-white/10">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-white/40 uppercase font-bold">Balance</span>
              <span className="text-xs font-mono font-bold">₹{user?.wallet_balance.toFixed(2)}</span>
            </div>
            <button className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              setToken(null);
            }}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 pb-24">
        {view === 'lobby' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setView('game')}
                className="group relative h-48 bg-gradient-to-br from-red-600 to-red-900 rounded-3xl p-6 flex flex-col justify-between overflow-hidden shadow-2xl shadow-red-900/20 active:scale-95 transition-all"
              >
                <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
                  <Trophy size={160} />
                </div>
                <div className="z-10">
                  <h3 className="text-2xl font-bold">Classic Table</h3>
                  <p className="text-white/60 text-sm">Entry: Free</p>
                </div>
                <div className="z-10 flex items-center gap-2 text-sm font-bold bg-black/20 w-fit px-3 py-1 rounded-full backdrop-blur-md">
                  Play Now <ChevronRight size={16} />
                </div>
              </button>

              <button className="group relative h-48 bg-[#151515] border border-white/5 rounded-3xl p-6 flex flex-col justify-between overflow-hidden active:scale-95 transition-all">
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
                  <Trophy size={160} />
                </div>
                <div className="z-10">
                  <h3 className="text-2xl font-bold">Tournaments</h3>
                  <p className="text-white/40 text-sm">Win Mega Prizes</p>
                </div>
                <div className="z-10 flex items-center gap-2 text-sm font-bold bg-white/5 w-fit px-3 py-1 rounded-full border border-white/10">
                  Coming Soon
                </div>
              </button>
            </div>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold uppercase tracking-widest text-white/40">Active Tables</h4>
                <span className="text-xs text-red-500 font-bold flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  1,240 Online
                </span>
              </div>
              <div className="space-y-3">
                {[10, 100, 500, 1000].map(fee => (
                  <div key={fee} className="bg-[#111] border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:border-white/20 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-red-600/10 transition-colors">
                        <Wallet className="w-6 h-6 text-white/40 group-hover:text-red-500" />
                      </div>
                      <div>
                        <p className="font-bold">Table ₹{fee}</p>
                        <p className="text-xs text-white/40">Min Bet: ₹{fee/10}</p>
                      </div>
                    </div>
                    <button className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-sm font-bold border border-white/10 transition-all">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === 'game' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button onClick={() => setView('lobby')} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <ArrowLeft />
              </button>
              <div className="flex gap-1">
                {gameState.history.map((h, i) => (
                  <div key={i} className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    h === 'dragon' ? "bg-red-600" : h === 'tiger' ? "bg-blue-600" : "bg-green-600"
                  )}>
                    {h[0].toUpperCase()}
                  </div>
                ))}
              </div>
            </div>

            {/* Game Table */}
            <div className="relative aspect-video bg-gradient-to-b from-red-900/20 to-black border border-white/10 rounded-[40px] overflow-hidden shadow-2xl flex flex-col items-center justify-center gap-8">
              <div className="absolute top-6 flex flex-col items-center">
                <div className={cn(
                  "text-4xl font-mono font-bold transition-colors",
                  gameState.timer <= 5 ? "text-red-500 animate-pulse" : "text-white"
                )}>
                  {gameState.timer}s
                </div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">
                  {gameState.status === 'betting' ? 'Place your bets' : gameState.status === 'dealing' ? 'Dealing...' : 'Result'}
                </span>
              </div>

              <div className="flex items-center gap-16">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key="dragon"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative"
                  >
                    <Card card={gameState.dragonCard} label="Dragon" />
                    {gameState.winner === 'dragon' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute -top-4 -right-4 bg-yellow-500 text-black text-[10px] font-black px-2 py-1 rounded-full shadow-lg"
                      >
                        WINNER
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <div className="text-4xl font-black text-white/10 italic">VS</div>

                <AnimatePresence mode="wait">
                  <motion.div 
                    key="tiger"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative"
                  >
                    <Card card={gameState.tigerCard} label="Tiger" />
                    {gameState.winner === 'tiger' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute -top-4 -right-4 bg-yellow-500 text-black text-[10px] font-black px-2 py-1 rounded-full shadow-lg"
                      >
                        WINNER
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Betting Zones */}
              <div className="absolute bottom-0 inset-x-0 h-1/3 grid grid-cols-3 gap-1 p-1">
                <button 
                  onClick={() => placeBet('dragon')}
                  disabled={gameState.status !== 'betting'}
                  className={cn(
                    "relative bg-red-600/10 hover:bg-red-600/20 border-t border-r border-white/5 transition-all flex flex-col items-center justify-center group",
                    gameState.winner === 'dragon' && "bg-red-600/40"
                  )}
                >
                  <span className="text-red-500 font-black text-xl group-hover:scale-110 transition-transform">DRAGON</span>
                  <span className="text-[10px] text-white/40 font-bold">Payout 1:1</span>
                  {myBets['dragon'] > 0 && (
                    <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ₹{myBets['dragon']}
                    </div>
                  )}
                </button>
                <button 
                  onClick={() => placeBet('tie')}
                  disabled={gameState.status !== 'betting'}
                  className={cn(
                    "relative bg-green-600/10 hover:bg-green-600/20 border-t border-white/5 transition-all flex flex-col items-center justify-center group",
                    gameState.winner === 'tie' && "bg-green-600/40"
                  )}
                >
                  <span className="text-green-500 font-black text-xl group-hover:scale-110 transition-transform">TIE</span>
                  <span className="text-[10px] text-white/40 font-bold">Payout 1:8</span>
                  {myBets['tie'] > 0 && (
                    <div className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ₹{myBets['tie']}
                    </div>
                  )}
                </button>
                <button 
                  onClick={() => placeBet('tiger')}
                  disabled={gameState.status !== 'betting'}
                  className={cn(
                    "relative bg-blue-600/10 hover:bg-blue-600/20 border-t border-l border-white/5 transition-all flex flex-col items-center justify-center group",
                    gameState.winner === 'tiger' && "bg-blue-600/40"
                  )}
                >
                  <span className="text-blue-500 font-black text-xl group-hover:scale-110 transition-transform">TIGER</span>
                  <span className="text-[10px] text-white/40 font-bold">Payout 1:1</span>
                  {myBets['tiger'] > 0 && (
                    <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ₹{myBets['tiger']}
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Chip Selection */}
            <div className="flex items-center justify-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10">
              {[10, 50, 100, 500, 1000].map(amount => (
                <button 
                  key={amount}
                  onClick={() => setBetAmount(amount)}
                  className={cn(
                    "w-14 h-14 rounded-full border-4 flex items-center justify-center font-bold text-xs transition-all active:scale-90",
                    betAmount === amount ? "border-red-600 scale-110 shadow-lg shadow-red-600/20" : "border-white/10 opacity-40 hover:opacity-100",
                    amount === 10 ? "bg-gray-600" : amount === 50 ? "bg-blue-600" : amount === 100 ? "bg-green-600" : amount === 500 ? "bg-purple-600" : "bg-red-600"
                  )}
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'admin' && user?.role === 'admin' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">Admin Panel</h3>
              <button onClick={() => setView('lobby')} className="text-sm text-white/40 hover:text-white">Exit</button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111] p-6 rounded-3xl border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="text-red-500" />
                  <h4 className="font-bold">Profit Mode</h4>
                </div>
                <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl">
                  <span className="text-sm">Risk Management</span>
                  <button className="w-12 h-6 bg-red-600 rounded-full relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                  </button>
                </div>
              </div>

              <div className="bg-[#111] p-6 rounded-3xl border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="text-blue-500" />
                  <h4 className="font-bold">User Control</h4>
                </div>
                <button className="w-full bg-white/5 hover:bg-white/10 py-3 rounded-xl text-sm font-bold transition-colors">
                  Manage Users
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <footer className="fixed bottom-0 inset-x-0 bg-black/80 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex items-center justify-between z-50">
        <button 
          onClick={() => setView('lobby')}
          className={cn("flex flex-col items-center gap-1 transition-colors", view === 'lobby' ? "text-red-500" : "text-white/40 hover:text-white")}
        >
          <Trophy size={20} />
          <span className="text-[10px] font-bold uppercase">Lobby</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-white/40 hover:text-white transition-colors">
          <History size={20} />
          <span className="text-[10px] font-bold uppercase">History</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-white/40 hover:text-white transition-colors">
          <MessageSquare size={20} />
          <span className="text-[10px] font-bold uppercase">Chat</span>
        </button>
        {user?.role === 'admin' && (
          <button 
            onClick={() => setView('admin')}
            className={cn("flex flex-col items-center gap-1 transition-colors", view === 'admin' ? "text-red-500" : "text-white/40 hover:text-white")}
          >
            <ShieldCheck size={20} />
            <span className="text-[10px] font-bold uppercase">Admin</span>
          </button>
        )}
        <button className="flex flex-col items-center gap-1 text-white/40 hover:text-white transition-colors">
          <User size={20} />
          <span className="text-[10px] font-bold uppercase">Profile</span>
        </button>
      </footer>
    </div>
  );
}
