'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { callAIAgent, AIAgentResponse, extractText } from '@/lib/aiAgent'
import { cn } from '@/lib/utils'
import { generateUUID } from '@/lib/utils'
import parseLLMJson from '@/lib/jsonParser'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { GiEarthAmerica, GiCrossedSwords, GiScrollUnfurled, GiDragonHead, GiCastle, GiCrystalBall, GiMagicSwirl, GiTreasureMap, GiCheckedShield } from 'react-icons/gi'
import { TbSend, TbArrowLeft, TbStarFilled, TbCircleFilled } from 'react-icons/tb'
import { RiHome4Fill, RiSwordFill, RiBookOpenFill, RiEarthFill, RiLoader4Line } from 'react-icons/ri'

// ==================== TYPES ====================

type TabId = 'hub' | 'world' | 'battles' | 'story' | 'monsters'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  parsedData?: any
  timestamp: number
  error?: boolean
}

interface WorkspaceState {
  messages: ChatMessage[]
  isLoading: boolean
  messageCount: number
}

// ==================== CONSTANTS ====================

const AGENT_IDS: Record<string, string> = {
  world: '69a1de07ff9f5d1338ea17c4',
  battles: '69a1de0700dc36bcc425acc4',
  story: '69a1de3195336657ed197779',
  monsters: '69a1de0800dc36bcc425acc6',
}

const WORKSPACE_CONFIG: Record<string, { title: string; description: string }> = {
  world: { title: 'World Builder', description: 'Design island environments, terrain, and architectural wonders for your monster summoner world.' },
  battles: { title: 'Battle System', description: 'Craft combat mechanics, duel rules, summoning systems, and balanced formulas.' },
  story: { title: 'Story Director', description: 'Write narrative arcs, dialogue, quests, and cinematic cutscene descriptions.' },
  monsters: { title: 'Monster Designer', description: 'Create monster cards with stats, abilities, lore, and artwork descriptions.' },
}

const QUICK_CHIPS: Record<string, string[]> = {
  world: ['Earth Town', 'Light Town', 'Fire Town', 'Dark Town', 'Water Town', 'Wind Town', 'Divine City', "Pharaoh's Pyramid"],
  battles: ['Battle Rules', 'Duel Rules', 'Summoning System', 'Monster Box', 'XP System', 'Buddy System'],
  story: ['Earth Town Intro', 'Light Town', 'Fire Town', 'Dark Town', 'Water Town', 'Wind Town', 'Orb Quest', 'Underground Discovery', 'Divine City', 'Final Chapter'],
  monsters: ['Spellcaster', 'Dragon', 'Zombie', 'Cyborg', 'High Dragon', 'Magical Knight', 'Earth Element', 'Light Element', 'Dark Element', 'Fire Element', 'Water Element', 'Wind Element', 'Divine Element'],
}

const CHIP_PROMPTS: Record<string, Record<string, string>> = {
  world: {
    'Earth Town': 'Design Earth Town - the starting town on the circular island with Gothic stone buildings, a professor\'s lab, player house, rival house, temple, and store. Earthy terrain with ancient ruins and nature paths.',
    'Light Town': 'Design Light Town - a radiant town bathed in golden sunlight with crystal spires, celestial architecture, and shimmering pathways on the circular island.',
    'Fire Town': 'Design Fire Town - a volcanic town built from lava rock with magma rivers, obsidian fortresses, and fiery wasteland terrain spiraling upward on the island.',
    'Dark Town': 'Design Dark Town - a shadowy cave-based town shrouded in perpetual twilight with gothic architecture and eerie underground passages on the island.',
    'Water Town': 'Design Water Town - a coastal town with cliff ruins, underwater grottos, coral structures, and tidal waterfalls along the island\'s edge.',
    'Wind Town': 'Design Wind Town - a sky-high town on the upper reaches of the island with wind-carved cliffs, cloud bridges, and aerial towers.',
    'Divine City': 'Design Divine City - the hidden divine city that floats high in the clouds above the entire circular island. It is unlocked after collecting all 6 elemental orbs. Features grand celestial architecture, golden spires piercing through clouds, and ethereal pathways.',
    "Pharaoh's Pyramid": 'Design the Pharaoh\'s Pyramid - a massive ancient pyramid at the center of the circular island next to the central lake. Contains hidden chambers, ancient keys, and underground secrets connecting to all towns.',
  },
  battles: {
    'Battle Rules': 'Design the core battle rules for monster summoner duels. Include turn order, action types, and win conditions.',
    'Duel Rules': 'Design the official duel rules and tournament format for competitive monster summoner battles.',
    'Summoning System': 'Design the summoning system - how players summon monsters using cards, mana costs, and field placement.',
    'Monster Box': 'Design the Monster Box system - monster storage, party management, and team composition rules.',
    'XP System': 'Design the experience point system - how monsters level up, evolve, and learn new abilities.',
    'Buddy System': 'Design the Buddy System - how a lead monster walks with the player and provides overworld bonuses.',
  },
  story: {
    'Earth Town Intro': 'Write the opening chapter set in Earth Town where the protagonist receives their first monster partner.',
    'Light Town': 'Write the Light Town chapter where the protagonist discovers the Light Orb and faces the Light Guardian.',
    'Fire Town': 'Write the Fire Town chapter with volcanic trials and the fierce Fire Guardian boss battle.',
    'Dark Town': 'Write the Dark Town chapter exploring the shadow realm and confronting the Dark Guardian.',
    'Water Town': 'Write the Water Town chapter with underwater exploration and the Water Guardian encounter.',
    'Wind Town': 'Write the Wind Town chapter set in the sky ruins with aerial challenges and the Wind Guardian.',
    'Orb Quest': 'Write the main Orb Quest arc where the protagonist must collect all 6 elemental orbs.',
    'Underground Discovery': 'Write the Underground Discovery chapter where a hidden civilization beneath the islands is revealed.',
    'Divine City': 'Write the Divine City chapter where all paths converge and the grand tournament begins.',
    'Final Chapter': 'Write the Final Chapter - the climactic battle against the ultimate antagonist.',
  },
  monsters: {
    'Spellcaster': 'Design a Spellcaster-type monster card with magic abilities, balanced stats, and detailed lore.',
    'Dragon': 'Design a Dragon-type monster card with powerful fire/breath attacks and legendary lore.',
    'Zombie': 'Design a Zombie-type monster card with undead abilities, resurrection mechanics, and dark lore.',
    'Cyborg': 'Design a Cyborg-type monster card with technology-enhanced abilities and futuristic lore.',
    'High Dragon': 'Design a High Dragon-type monster card - an evolved legendary dragon with supreme power.',
    'Magical Knight': 'Design a Magical Knight-type monster card combining sword skills with arcane magic.',
    'Earth Element': 'Design an Earth-element monster with terrain-shaping abilities and nature-based lore.',
    'Light Element': 'Design a Light-element monster with healing and purification abilities.',
    'Dark Element': 'Design a Dark-element monster with shadow manipulation and curse abilities.',
    'Fire Element': 'Design a Fire-element monster with blazing attacks and volcanic lore.',
    'Water Element': 'Design a Water-element monster with tidal abilities and ocean-dwelling lore.',
    'Wind Element': 'Design a Wind-element monster with aerial speed and storm abilities.',
    'Divine Element': 'Design a Divine-element monster - a rare celestial creature with holy power.',
  },
}

const ELEMENT_COLORS: Record<string, string> = {
  fire: 'bg-red-600 text-white',
  Fire: 'bg-red-600 text-white',
  water: 'bg-blue-600 text-white',
  Water: 'bg-blue-600 text-white',
  earth: 'bg-amber-700 text-white',
  Earth: 'bg-amber-700 text-white',
  light: 'bg-yellow-400 text-black',
  Light: 'bg-yellow-400 text-black',
  dark: 'bg-purple-800 text-white',
  Dark: 'bg-purple-800 text-white',
  wind: 'bg-emerald-500 text-white',
  Wind: 'bg-emerald-500 text-white',
  divine: 'bg-amber-400 text-black',
  Divine: 'bg-amber-400 text-black',
}

// ==================== SAMPLE DATA ====================

const SAMPLE_WORLD = {
  location_name: 'Earth Town',
  architectural_style: 'Gothic stone buildings with moss-covered pillars, arched doorways, and ancient stonework towers',
  terrain_description: 'The starting town on the circular island, nestled at the base elevation. Dense emerald forests surround Gothic stone structures, with cobblestone paths winding between ancient megaliths and cascading waterfalls feeding into the central lake.',
  key_buildings: ["Professor's Lab", 'Player House', 'Rival House', 'Stone Temple', 'General Store', 'Earth Coliseum'],
  environmental_effects: ['Floating spores that heal nearby monsters', 'Shifting stone platforms during battles', 'Periodic earthquakes that reshape terrain'],
  interactive_elements: ['Climbable vines on temple walls', 'Breakable boulders hiding secret paths', 'Ancient rune stones that teach earth spells', 'Underground passage entrance near the temple'],
  elevation_notes: 'Earth Town sits at the lowest elevation on the circular island, with paths spiraling upward toward the other elemental towns and the central Pharaoh\'s Pyramid.',
  design_summary: 'The hometown and starting area, blending Gothic stone architecture with lush nature. Contains all essential facilities for new summoners beginning their journey around the circular island.',
}

const SAMPLE_BATTLE = {
  mechanic_name: 'Elemental Summoning Duel',
  category: 'Core Combat',
  rules: ['Each duelist begins with 5 Summoning Points (SP)', 'Monsters are summoned to 1 of 3 field zones', 'Turn order is determined by monster SPD stat', 'A duelist loses when all field monsters are defeated'],
  formulas: ['Damage = (ATK * Element Modifier) - (DEF / 2)', 'Element Modifier: 1.5x (advantage), 1.0x (neutral), 0.5x (disadvantage)', 'Critical Hit = 10% + (SPD / 200) chance for 2x damage'],
  flowchart_steps: ['Draw Phase: Draw 1 card', 'Summon Phase: Play monster or spell card', 'Battle Phase: Select attacker and target', 'Damage Calculation Phase', 'End Phase: Discard to hand limit'],
  examples: ['Player A summons Fire Dragon (ATK 2400) vs Player B Water Serpent (DEF 1800): Damage = (2400 * 0.5) - (1800/2) = 300'],
  balance_notes: 'Elemental triangles ensure no single element dominates. High ATK is offset by low DEF to encourage diverse team building.',
  design_summary: 'A strategic 3-zone field duel system with elemental rock-paper-scissors and resource management via Summoning Points.',
}

const SAMPLE_STORY = {
  chapter_title: 'Chapter 1: Awakening in Earth Town',
  story_beats: ['Protagonist wakes in their home on Earth Island', 'Elder summons them to the Stone Temple', 'They receive their first monster partner', 'A mysterious stranger appears and steals the Earth Orb', 'Protagonist begins their journey to recover the Orb'],
  dialogue: ['"You have been chosen by the ancient stones," the Elder said, placing a warm egg in your hands.', '"That orb... it cannot fall into the wrong hands. You must pursue them!" the Elder urged.', '"My name? You can call me... a friend. For now." The stranger vanished into shadow.'],
  characters_involved: ['Protagonist', 'Elder Gaia', 'Mysterious Stranger', 'First Monster Partner'],
  quest_objectives: ['Visit the Stone Temple of Gaia', 'Bond with your first monster partner', 'Pursue the Mysterious Stranger to the forest border', 'Defeat 3 wild monsters along the path'],
  cutscene_description: 'The camera pans over Earth Island at dawn. Golden light filters through ancient trees as stone monoliths hum with energy. The protagonist steps outside their cottage, feeling the ground pulse beneath their feet.',
  lore_notes: 'Earth Town is the oldest settlement in the archipelago, founded by the first Summoners who forged pacts with the land itself.',
  narrative_summary: 'An introductory chapter establishing the protagonist, their world, and the inciting incident that launches the quest for the elemental orbs.',
}

const SAMPLE_MONSTER = {
  monster_name: 'Pyroclasm Dragon',
  monster_type: 'Dragon',
  element: 'Fire',
  level: 7,
  atk: 2800,
  def: 2100,
  spd: 1600,
  summon_type: 'Fusion Summon',
  summon_materials: ['Flame Wyvern', 'Magma Golem'],
  special_abilities: ['Inferno Breath: Deal 800 direct damage and apply Burn for 3 turns', 'Volcanic Armor: Reduce incoming damage by 300 for 2 turns', 'Eruption Finale: Once per duel, destroy all opposing monsters with DEF lower than this card ATK'],
  lore: 'Born from the heart of a dying volcano, Pyroclasm Dragon carries the fury of a thousand eruptions. Summoners brave enough to bond with it gain mastery over fire itself.',
  artwork_description: 'A massive red-and-black scaled dragon erupting from a volcano crater, magma dripping from its wings, eyes blazing with molten gold. The background is a sea of lava under a crimson sky.',
  card_summary: 'A high-level Fusion Dragon with devastating AoE and burn mechanics, balanced by steep summoning requirements.',
}

// ==================== ERROR BOUNDARY ====================

class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Try again</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ==================== HELPERS ====================

const safeArray = (val: any): string[] => Array.isArray(val) ? val : []

function parseAgentResponse(result: AIAgentResponse) {
  if (!result.success) return null
  const response = result.response
  if (response?.status === 'success' && response?.result) {
    const data = response.result
    if (typeof data === 'object' && !Array.isArray(data)) {
      return data
    }
  }
  if (response?.message) {
    try {
      const parsed = parseLLMJson(response.message)
      if (parsed && typeof parsed === 'object') return parsed
    } catch {}
  }
  const text = extractText(response)
  if (text) {
    try {
      const parsed = parseLLMJson(text)
      if (parsed && typeof parsed === 'object') return parsed
    } catch {}
  }
  return null
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part)
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

// ==================== WORKSPACE ICON HELPER ====================

function WorkspaceIcon({ workspace, size = 20 }: { workspace: string; size?: number }) {
  switch (workspace) {
    case 'world': return <GiEarthAmerica size={size} />
    case 'battles': return <GiCrossedSwords size={size} />
    case 'story': return <GiScrollUnfurled size={size} />
    case 'monsters': return <GiDragonHead size={size} />
    default: return <RiHome4Fill size={size} />
  }
}

// ==================== RESPONSE RENDERERS ====================

function WorldResponse({ data }: { data: any }) {
  if (!data) return null
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-bold neon-glow">{data?.location_name ?? 'Unknown Location'}</h3>
        <p className="text-sm text-muted-foreground italic">{data?.architectural_style ?? ''}</p>
      </div>
      {data?.terrain_description && (
        <div className="p-3 rounded bg-muted/30 border border-border/50">
          <p className="text-sm">{data.terrain_description}</p>
        </div>
      )}
      {safeArray(data?.key_buildings).length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><GiCastle size={14} /> Key Buildings</h4>
          <div className="space-y-1">
            {safeArray(data.key_buildings).map((b: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm"><TbCircleFilled size={6} className="mt-1.5 text-primary shrink-0" /><span>{b}</span></div>
            ))}
          </div>
        </div>
      )}
      {safeArray(data?.environmental_effects).length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Environmental Effects</h4>
          <div className="flex flex-wrap gap-1.5">
            {safeArray(data.environmental_effects).map((e: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs border-green-500/40 text-green-400">{e}</Badge>
            ))}
          </div>
        </div>
      )}
      {safeArray(data?.interactive_elements).length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Interactive Elements</h4>
          <div className="space-y-1">
            {safeArray(data.interactive_elements).map((el: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm"><GiTreasureMap size={14} className="mt-0.5 text-accent shrink-0" /><span>{el}</span></div>
            ))}
          </div>
        </div>
      )}
      {data?.elevation_notes && (
        <div className="p-2 rounded bg-muted/20 border-l-2 border-primary/50">
          <p className="text-xs text-muted-foreground"><strong>Elevation:</strong> {data.elevation_notes}</p>
        </div>
      )}
      {data?.design_summary && (
        <div className="p-3 rounded bg-primary/10 border border-primary/20">
          <h4 className="text-xs uppercase tracking-wider text-primary mb-1">Design Summary</h4>
          <p className="text-sm">{data.design_summary}</p>
        </div>
      )}
    </div>
  )
}

function BattleResponse({ data }: { data: any }) {
  if (!data) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-lg font-bold neon-glow">{data?.mechanic_name ?? 'Battle Mechanic'}</h3>
        {data?.category && <Badge className="bg-red-600/80 text-white text-xs">{data.category}</Badge>}
      </div>
      {safeArray(data?.rules).length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><GiCheckedShield size={14} /> Rules</h4>
          <ol className="space-y-1.5">
            {safeArray(data.rules).map((r: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-red-600/30 text-red-400 flex items-center justify-center text-xs shrink-0 mt-0.5">{i + 1}</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {safeArray(data?.formulas).length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Formulas</h4>
          <div className="space-y-1.5">
            {safeArray(data.formulas).map((f: string, i: number) => (
              <div key={i} className="p-2 rounded bg-muted/40 font-mono text-xs border border-border/30">{f}</div>
            ))}
          </div>
        </div>
      )}
      {safeArray(data?.flowchart_steps).length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Battle Flow</h4>
          <div className="space-y-1">
            {safeArray(data.flowchart_steps).map((s: string, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">{i + 1}</div>
                <span className="flex-1">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {safeArray(data?.examples).length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Examples</h4>
          {safeArray(data.examples).map((ex: string, i: number) => (
            <div key={i} className="p-2 rounded bg-accent/10 border border-accent/20 text-sm italic mb-1.5">{ex}</div>
          ))}
        </div>
      )}
      {data?.balance_notes && (
        <div className="p-2 rounded bg-muted/20 border-l-2 border-accent/50">
          <p className="text-xs text-muted-foreground"><strong>Balance Notes:</strong> {data.balance_notes}</p>
        </div>
      )}
      {data?.design_summary && (
        <div className="p-3 rounded bg-primary/10 border border-primary/20">
          <h4 className="text-xs uppercase tracking-wider text-primary mb-1">Design Summary</h4>
          <p className="text-sm">{data.design_summary}</p>
        </div>
      )}
    </div>
  )
}

function StoryResponse({ data }: { data: any }) {
  if (!data) return null
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold neon-glow">{data?.chapter_title ?? 'Untitled Chapter'}</h3>
      {data?.cutscene_description && (
        <div className="p-3 rounded bg-purple-900/20 border border-purple-500/20 italic text-sm text-purple-300">
          {data.cutscene_description}
        </div>
      )}
      {safeArray(data?.story_beats).length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Story Beats</h4>
          <div className="space-y-2 border-l-2 border-purple-500/30 pl-3">
            {safeArray(data.story_beats).map((beat: string, i: number) => (
              <div key={i} className="relative text-sm">
                <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-purple-500/60 border border-purple-400" />
                {beat}
              </div>
            ))}
          </div>
        </div>
      )}
      {safeArray(data?.dialogue).length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Dialogue</h4>
          <div className="space-y-2">
            {safeArray(data.dialogue).map((d: string, i: number) => (
              <div key={i} className="p-2.5 rounded bg-muted/30 border-l-2 border-secondary/50 text-sm italic">
                {d}
              </div>
            ))}
          </div>
        </div>
      )}
      {safeArray(data?.characters_involved).length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Characters</h4>
          <div className="flex flex-wrap gap-1.5">
            {safeArray(data.characters_involved).map((c: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs border-secondary/40 text-secondary">{c}</Badge>
            ))}
          </div>
        </div>
      )}
      {safeArray(data?.quest_objectives).length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Quest Objectives</h4>
          <div className="space-y-1.5">
            {safeArray(data.quest_objectives).map((q: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <div className="w-4 h-4 rounded border border-primary/50 mt-0.5 shrink-0" />
                <span>{q}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data?.lore_notes && (
        <div className="p-2 rounded bg-muted/20 border-l-2 border-purple-500/50">
          <p className="text-xs text-muted-foreground"><strong>Lore:</strong> {data.lore_notes}</p>
        </div>
      )}
      {data?.narrative_summary && (
        <div className="p-3 rounded bg-primary/10 border border-primary/20">
          <h4 className="text-xs uppercase tracking-wider text-primary mb-1">Narrative Summary</h4>
          <p className="text-sm">{data.narrative_summary}</p>
        </div>
      )}
    </div>
  )
}

function MonsterCardResponse({ data }: { data: any }) {
  if (!data) return null
  const elementClass = ELEMENT_COLORS[data?.element ?? ''] ?? 'bg-muted text-foreground'
  const level = typeof data?.level === 'number' ? data.level : 1
  return (
    <div className="max-w-sm mx-auto">
      <div className="rounded-lg border-2 border-primary/40 overflow-hidden bg-card/80 neon-border">
        <div className="p-3 bg-gradient-to-r from-muted/60 to-card">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold neon-glow">{data?.monster_name ?? 'Unknown Monster'}</h3>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: Math.min(level, 12) }).map((_, i) => (
                <TbStarFilled key={i} size={10} className="text-yellow-400" />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {data?.monster_type && <Badge variant="outline" className="text-xs">{data.monster_type}</Badge>}
            {data?.element && <Badge className={cn('text-xs', elementClass)}>{data.element}</Badge>}
            {data?.summon_type && <Badge variant="outline" className="text-xs border-accent/40 text-accent">{data.summon_type}</Badge>}
          </div>
        </div>
        {data?.artwork_description && (
          <div className="p-3 mx-3 mt-2 rounded bg-muted/30 border border-border/30 text-xs italic text-muted-foreground min-h-[60px] flex items-center">
            <GiCrystalBall size={16} className="mr-2 shrink-0 text-secondary" />
            <span>{data.artwork_description}</span>
          </div>
        )}
        <div className="p-3">
          <div className="flex justify-around py-2 mb-3 rounded bg-muted/30 border border-border/30">
            <div className="text-center">
              <div className="text-xs text-muted-foreground uppercase">ATK</div>
              <div className="text-lg font-bold text-red-400">{data?.atk ?? '?'}</div>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="text-center">
              <div className="text-xs text-muted-foreground uppercase">DEF</div>
              <div className="text-lg font-bold text-blue-400">{data?.def ?? '?'}</div>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="text-center">
              <div className="text-xs text-muted-foreground uppercase">SPD</div>
              <div className="text-lg font-bold text-green-400">{data?.spd ?? '?'}</div>
            </div>
          </div>
          {safeArray(data?.summon_materials).length > 0 && (
            <div className="mb-2">
              <h4 className="text-xs text-muted-foreground uppercase mb-1">Summon Materials</h4>
              <div className="flex flex-wrap gap-1">
                {safeArray(data.summon_materials).map((m: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">{m}</Badge>
                ))}
              </div>
            </div>
          )}
          {safeArray(data?.special_abilities).length > 0 && (
            <div className="mb-2">
              <h4 className="text-xs text-muted-foreground uppercase mb-1">Special Abilities</h4>
              <div className="space-y-1">
                {safeArray(data.special_abilities).map((a: string, i: number) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <GiMagicSwirl size={12} className="mt-0.5 text-secondary shrink-0" />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data?.lore && (
            <div className="p-2 rounded bg-muted/20 mt-2 border-l-2 border-secondary/40">
              <p className="text-xs italic text-muted-foreground">{data.lore}</p>
            </div>
          )}
        </div>
        {data?.card_summary && (
          <div className="p-2 bg-primary/10 border-t border-primary/20">
            <p className="text-xs text-center">{data.card_summary}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AgentResponseRenderer({ workspace, data, rawText }: { workspace: string; data: any; rawText?: string }) {
  if (data && typeof data === 'object' && Object.keys(data).length > 0) {
    switch (workspace) {
      case 'world': return <WorldResponse data={data} />
      case 'battles': return <BattleResponse data={data} />
      case 'story': return <StoryResponse data={data} />
      case 'monsters': return <MonsterCardResponse data={data} />
    }
  }
  if (rawText) {
    return <div className="text-sm">{renderMarkdown(rawText)}</div>
  }
  return <p className="text-sm text-muted-foreground">No data to display.</p>
}

// ==================== LOADING SKELETON ====================

function LoadingSkeleton({ workspace }: { workspace: string }) {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-6 w-48 bg-muted/40" />
      <Skeleton className="h-4 w-32 bg-muted/30" />
      <Skeleton className="h-16 w-full bg-muted/30" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 bg-muted/30" />
        <Skeleton className="h-6 w-24 bg-muted/30" />
        <Skeleton className="h-6 w-16 bg-muted/30" />
      </div>
      <Skeleton className="h-12 w-full bg-muted/30" />
      <Skeleton className="h-4 w-3/4 bg-muted/30" />
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <RiLoader4Line size={14} className="animate-spin" />
        <span>Generating {workspace === 'monsters' ? 'monster card' : workspace === 'story' ? 'narrative' : workspace === 'battles' ? 'battle system' : 'world design'}...</span>
      </div>
    </div>
  )
}

// ==================== HUB DASHBOARD ====================

function HubDashboard({ workspaces, onNavigate, sampleMode, onToggleSample }: {
  workspaces: Record<string, WorkspaceState>
  onNavigate: (tab: TabId) => void
  sampleMode: boolean
  onToggleSample: () => void
}) {
  const cards: { id: TabId; title: string; desc: string; icon: React.ReactNode; gradient: string; borderHover: string }[] = [
    { id: 'world', title: 'World Builder', desc: WORKSPACE_CONFIG.world.description, icon: <GiEarthAmerica size={28} />, gradient: 'from-green-500/20 to-emerald-900/20', borderHover: 'hover:border-green-500/50' },
    { id: 'battles', title: 'Battle System', desc: WORKSPACE_CONFIG.battles.description, icon: <GiCrossedSwords size={28} />, gradient: 'from-red-500/20 to-orange-900/20', borderHover: 'hover:border-red-500/50' },
    { id: 'story', title: 'Story Director', desc: WORKSPACE_CONFIG.story.description, icon: <GiScrollUnfurled size={28} />, gradient: 'from-purple-500/20 to-fuchsia-900/20', borderHover: 'hover:border-purple-500/50' },
    { id: 'monsters', title: 'Monster Designer', desc: WORKSPACE_CONFIG.monsters.description, icon: <GiDragonHead size={28} />, gradient: 'from-yellow-500/20 to-amber-900/20', borderHover: 'hover:border-yellow-500/50' },
  ]

  return (
    <div className="flex flex-col min-h-full">
      <div className="relative w-full h-48 overflow-hidden">
        <img
          src="https://asset.lyzr.app/tj14blWc"
          alt="Monster Summoners Island Concept Art"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl font-bold neon-glow tracking-tight">Monster Summoners Studio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Design your monster summoner game world</p>
        </div>
      </div>

      <div className="p-4 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Workspaces</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sample Data</span>
            <button
              onClick={onToggleSample}
              className={cn('relative w-10 h-5 rounded-full transition-colors duration-200', sampleMode ? 'bg-primary' : 'bg-muted')}
              aria-label="Toggle sample data"
            >
              <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200', sampleMode ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {cards.map((card) => {
            const count = sampleMode
              ? (card.id === 'world' ? 3 : card.id === 'battles' ? 2 : card.id === 'story' ? 4 : 5)
              : (workspaces[card.id]?.messageCount ?? 0)
            return (
              <button
                key={card.id}
                onClick={() => onNavigate(card.id)}
                className={cn('glass-card rounded-lg p-3 text-left transition-all duration-300 hover:scale-[1.02] group relative overflow-hidden', card.borderHover)}
              >
                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-50', card.gradient)} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-primary">{card.icon}</div>
                    {count > 0 && (
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">{count}</Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{card.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{card.desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-6">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Agent Status</h2>
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-3 space-y-2">
              {[
                { name: 'World Builder Agent', workspace: 'world' },
                { name: 'Battle System Architect', workspace: 'battles' },
                { name: 'Narrative Director', workspace: 'story' },
                { name: 'Monster & Card Designer', workspace: 'monsters' },
              ].map((agent) => (
                <div key={agent.workspace} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <WorkspaceIcon workspace={agent.workspace} size={14} />
                    <span>{agent.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {workspaces[agent.workspace]?.isLoading ? (
                      <>
                        <RiLoader4Line size={10} className="animate-spin text-primary" />
                        <span className="text-primary">Active</span>
                      </>
                    ) : (
                      <>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span className="text-muted-foreground">Ready</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ==================== QUICK CHIPS ====================

function QuickChipsBar({ workspace, onChipClick }: { workspace: string; onChipClick: (prompt: string) => void }) {
  const chips = QUICK_CHIPS[workspace] ?? []
  const prompts = CHIP_PROMPTS[workspace] ?? {}
  return (
    <div className="flex gap-1.5 overflow-x-auto py-2 px-4" style={{ scrollbarWidth: 'none' }}>
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onChipClick(prompts[chip] ?? `Design a ${chip} concept`)}
          className="shrink-0 px-3 py-1 rounded-full text-xs border border-border/50 bg-muted/30 text-foreground hover:bg-primary/20 hover:border-primary/40 transition-all duration-200 whitespace-nowrap"
        >
          {chip}
        </button>
      ))}
    </div>
  )
}

// ==================== CHAT WORKSPACE ====================

function ChatWorkspace({
  workspace,
  messages,
  isLoading,
  onSend,
  onBack,
  sampleMode,
}: {
  workspace: string
  messages: ChatMessage[]
  isLoading: boolean
  onSend: (message: string) => void
  onBack: () => void
  sampleMode: boolean
}) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const config = WORKSPACE_CONFIG[workspace] ?? { title: 'Workspace', description: '' }

  const sampleMessages = useMemo<ChatMessage[]>(() => {
    if (!sampleMode) return []
    const sampleDataMap: Record<string, any> = {
      world: SAMPLE_WORLD,
      battles: SAMPLE_BATTLE,
      story: SAMPLE_STORY,
      monsters: SAMPLE_MONSTER,
    }
    const samplePromptMap: Record<string, string> = {
      world: 'Design Earth Town - the starting town with Gothic stone buildings and earthy terrain.',
      battles: 'Design the core battle rules for monster summoner duels.',
      story: 'Write the opening chapter set in Earth Town.',
      monsters: 'Design a Dragon-type monster card with powerful fire attacks.',
    }
    return [
      { id: 'sample-user-1', role: 'user' as const, content: samplePromptMap[workspace] ?? 'Sample prompt', timestamp: Date.now() - 60000 },
      { id: 'sample-ai-1', role: 'assistant' as const, content: '', parsedData: sampleDataMap[workspace], timestamp: Date.now() - 30000 },
    ]
  }, [sampleMode, workspace])

  const displayMessages = sampleMode ? sampleMessages : messages

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [displayMessages, isLoading])

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, isLoading, onSend])

  const handleChipClick = useCallback((prompt: string) => {
    setInput(prompt)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-card/30 shrink-0">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <TbArrowLeft size={20} />
        </button>
        <div className="text-primary">
          <WorkspaceIcon workspace={workspace} size={22} />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold truncate">{config.title}</h2>
        </div>
      </div>

      <div className="shrink-0">
        <QuickChipsBar workspace={workspace} onChipClick={handleChipClick} />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {displayMessages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 opacity-60">
            <div className="mb-3 text-primary">
              <WorkspaceIcon workspace={workspace} size={48} />
            </div>
            <h3 className="text-sm font-semibold mb-1">{config.title}</h3>
            <p className="text-xs text-muted-foreground max-w-xs">{config.description} Select a chip above or type your own prompt below.</p>
          </div>
        )}

        {displayMessages.map((msg) => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[92%] rounded-lg',
              msg.role === 'user'
                ? 'bg-primary/20 border border-primary/30 p-3'
                : 'bg-card/60 border border-border/30 p-3'
            )}>
              {msg.role === 'user' ? (
                <p className="text-sm">{msg.content}</p>
              ) : msg.error ? (
                <div className="text-sm text-destructive">
                  <p>{msg.content}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => {
                      const prevUserMsg = [...displayMessages].reverse().find(m => m.role === 'user' && m.timestamp < msg.timestamp)
                      if (prevUserMsg?.content) onSend(prevUserMsg.content)
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <AgentResponseRenderer
                  workspace={workspace}
                  data={msg.parsedData}
                  rawText={msg.content}
                />
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[92%] rounded-lg bg-card/60 border border-border/30">
              <LoadingSkeleton workspace={workspace} />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border/30 bg-card/20 shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={`Describe your ${workspace === 'monsters' ? 'monster card' : workspace === 'story' ? 'narrative' : workspace === 'battles' ? 'battle mechanic' : 'world design'}...`}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none bg-input/50 border-border/50 text-sm"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="sm"
            className="h-10 w-10 p-0 shrink-0"
          >
            {isLoading ? <RiLoader4Line size={18} className="animate-spin" /> : <TbSend size={18} />}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ==================== BOTTOM TAB BAR ====================

function BottomTabBar({ activeTab, onTabChange, workspaces }: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  workspaces: Record<string, WorkspaceState>
}) {
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'hub', label: 'Hub', icon: <RiHome4Fill size={20} /> },
    { id: 'world', label: 'World', icon: <RiEarthFill size={20} /> },
    { id: 'battles', label: 'Battles', icon: <RiSwordFill size={20} /> },
    { id: 'story', label: 'Story', icon: <RiBookOpenFill size={20} /> },
    { id: 'monsters', label: 'Monsters', icon: <GiDragonHead size={20} /> },
  ]

  return (
    <div className="flex items-center justify-around border-t border-border/30 bg-card/60 backdrop-blur-lg py-1.5 shrink-0">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const hasActivity = tab.id !== 'hub' && (workspaces[tab.id]?.isLoading ?? false)
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn('flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all duration-200 relative', isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
          >
            {isActive && <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary shadow-[0_0_8px_hsl(180_100%_50%/0.6)]" />}
            <div className={cn(isActive && 'drop-shadow-[0_0_6px_hsl(180_100%_50%/0.5)]')}>
              {tab.icon}
            </div>
            <span className="text-[10px] font-medium">{tab.label}</span>
            {hasActivity && <div className="absolute top-0.5 right-1 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
          </button>
        )
      })}
    </div>
  )
}

// ==================== MAIN PAGE ====================

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabId>('hub')
  const [sampleMode, setSampleMode] = useState(false)
  const [workspaces, setWorkspaces] = useState<Record<string, WorkspaceState>>({
    world: { messages: [], isLoading: false, messageCount: 0 },
    battles: { messages: [], isLoading: false, messageCount: 0 },
    story: { messages: [], isLoading: false, messageCount: 0 },
    monsters: { messages: [], isLoading: false, messageCount: 0 },
  })

  const sessionIds = useRef<Record<string, string>>({
    world: `world_${generateUUID()}`,
    battles: `battles_${generateUUID()}`,
    story: `story_${generateUUID()}`,
    monsters: `monsters_${generateUUID()}`,
  })

  const sendMessage = useCallback(async (workspace: string, message: string) => {
    if (!message.trim()) return
    const agentId = AGENT_IDS[workspace]
    if (!agentId) return

    const userMsg: ChatMessage = {
      id: generateUUID(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }

    setWorkspaces(prev => ({
      ...prev,
      [workspace]: {
        ...prev[workspace],
        messages: [...(prev[workspace]?.messages ?? []), userMsg],
        isLoading: true,
        messageCount: (prev[workspace]?.messageCount ?? 0) + 1,
      },
    }))

    try {
      const result = await callAIAgent(message, agentId, {
        session_id: sessionIds.current[workspace],
      })

      const parsedData = parseAgentResponse(result)
      const rawText = result?.response ? extractText(result.response) : ''

      const assistantMsg: ChatMessage = {
        id: generateUUID(),
        role: 'assistant',
        content: rawText || '',
        parsedData: parsedData,
        timestamp: Date.now(),
        error: !result.success,
      }

      if (!result.success) {
        assistantMsg.content = result.error ?? 'An error occurred. Please try again.'
      }

      setWorkspaces(prev => ({
        ...prev,
        [workspace]: {
          ...prev[workspace],
          messages: [...(prev[workspace]?.messages ?? []), assistantMsg],
          isLoading: false,
          messageCount: (prev[workspace]?.messageCount ?? 0) + 1,
        },
      }))
    } catch {
      const errorMsg: ChatMessage = {
        id: generateUUID(),
        role: 'assistant',
        content: 'Network error. Please check your connection and try again.',
        timestamp: Date.now(),
        error: true,
      }
      setWorkspaces(prev => ({
        ...prev,
        [workspace]: {
          ...prev[workspace],
          messages: [...(prev[workspace]?.messages ?? []), errorMsg],
          isLoading: false,
        },
      }))
    }
  }, [])

  const handleNavigate = useCallback((tab: TabId) => {
    setActiveTab(tab)
  }, [])

  const handleToggleSample = useCallback(() => {
    setSampleMode(prev => !prev)
  }, [])

  return (
    <PageErrorBoundary>
      <div className="h-screen max-h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'hub' && (
            <div className="absolute inset-0 overflow-y-auto">
              <HubDashboard
                workspaces={workspaces}
                onNavigate={handleNavigate}
                sampleMode={sampleMode}
                onToggleSample={handleToggleSample}
              />
            </div>
          )}

          {activeTab !== 'hub' && (
            <div className="absolute inset-0 flex flex-col">
              <ChatWorkspace
                workspace={activeTab}
                messages={workspaces[activeTab]?.messages ?? []}
                isLoading={workspaces[activeTab]?.isLoading ?? false}
                onSend={(msg) => sendMessage(activeTab, msg)}
                onBack={() => setActiveTab('hub')}
                sampleMode={sampleMode}
              />
            </div>
          )}
        </div>

        <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} workspaces={workspaces} />
      </div>
    </PageErrorBoundary>
  )
}
