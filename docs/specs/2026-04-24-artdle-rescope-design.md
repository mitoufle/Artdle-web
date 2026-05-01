# Artdle — Rescope & Rebuild Design

**Date :** 2026-04-24
**Statut :** Spec pour relecture

## 1. Contexte

Artdle est un idle / clicker game de peinture développé en Godot 4 + GDScript. Le projet a atteint un point où l'architecture actuelle est jugée "pas assez solide" par son créateur. Audit réalisé : le cœur (currencies, ascend, clicker, save) porte des dettes techniques (UIFormatter dupliqué, overflow silencieux dans `BigNumberManager`, currencies redondantes, XP système au rôle flou, signals émis sans consommateur), tandis que la périphérie (vues, popups) est globalement saine mais couplée à cette base fragile.

La décision prise : **rebuild from scratch** du code GDScript (approche 3 du brainstorm), en conservant uniquement les assets non-code (`artdleAsset/`, `themes/`, `icon.svg`, `project.godot`) et les layouts `.tscn` des popups/vues comme référence visuelle (sans leurs scripts).

Ce document spécifie la cible à atteindre : une base MVP flawless sur laquelle on pourra ajouter du contenu sans dette technique.

## 2. Boucle de jeu (MVP)

```
Arbre (main panel, passif)  →  Inspiration
Canvas (painting screen)    →  Gold + Paint mastery
Gold                        →  Améliore l'arbre + débloque/upgrade sous-mécaniques
Inspiration                 →  Débloque workshop/inventory/painter office + paye l'ascend
Ascend (consomme inspi)     →  Fame (permanente)
Fame                        →  Spend dans skill tree (permanent, séparé de l'arbre)
Paint mastery (permanent)   →  Multiplicateur passif sur tout l'output painting
```

Le **canvas** est la mécanique de production centrale : c'est lui qui produit le gold qui alimente la croissance de l'arbre. Les sous-mécaniques (workshop, inventory, craft, painter office) sont des **multiplicateurs du canvas**, toutes payées en gold, sans currencies propres au MVP.

Le **joueur progresse** en :
1. Faisant pousser son arbre (dépense gold) pour gagner plus d'inspi/s.
2. Achetant avec l'inspi les débloquages des sous-mécaniques, qui multiplient son output canvas.
3. Ascendant quand il a assez d'inspi, pour convertir en fame et dépenser dans le skill tree.
4. Accumulant du paint mastery au fil des ventes de canvas, ce qui boost la boucle sur le très long terme.

## 3. Currency model

| Currency | Source | Usage | Reset à l'ascend |
|---|---|---|---|
| **Inspiration** | Arbre uniquement (passif) | Débloquer sous-mécaniques + upgrades + payer l'ascend | ✅ reset |
| **Gold** | Canvas uniquement (primaire) | Améliorer arbre + payer upgrades/items/workers | ✅ reset |
| **Fame** | Ascend (conversion inspi → fame) | Skill tree (permanent) | ❌ permanent |
| **Paint mastery** | Vente canvas (log curve) | Multiplicateur passif painting output | ❌ permanent |

**Currencies supprimées** par rapport au code actuel :
- `ascendancy_points` → fusionnée dans **fame**.
- `skill_points` → fusionnée dans **fame**.
- `experience` / niveau / XP bar → **cut complet** (redondant avec fame/paint_mastery/ascend count comme indicateurs de progression).

**Règle :** une seule currency par rôle. Toute ajout de currency future doit justifier pourquoi les 4 existantes ne suffisent pas.

## 4. Arbre d'inspiration (main panel)

### Structure

Forme hybride : **stades de croissance** (20-30 stades, log-spaced) × **parties anatomiques** (racines, branches, feuilles, fleurs, fruits...) × **upgrades par partie** (plusieurs niveaux).

Progression au sein d'un stade :
1. Le joueur arrive au stade avec un set de parties disponibles.
2. Il achète des upgrades par partie, payés en gold, coût croissant par niveau.
3. Quand toutes les parties du stade sont max level (ou qu'un seuil de gold cumulé est atteint — à préciser dans `Balance.gd`), le stade suivant se débloque.
4. Nouveau stade = nouveau visuel + nouvelles parties apparaissent.

### Unlock des sous-mécaniques (modèle C — stade + inspiration)

Certains stades débloquent la **possibilité** d'activer une sous-mécanique. L'activation réelle coûte de l'inspiration.

Exemple (valeurs indicatives, à tuner) :
- Stade 3 "Jeune pousse" → possibilité de débloquer le workshop (coût : 500 inspi)
- Stade 6 "Mature" → possibilité de débloquer l'inventory (coût : 2 500 inspi)
- Stade 9 "Ancien" → possibilité de débloquer le painter office (coût : 10 000 inspi)

Tant que le joueur n'a pas payé, l'UI de la sous-mécanique reste grisée/cachée dans la PaintingView.

### Tick passif

```
inspi_per_sec = sum(part.level × part.base_rate for each active part)
              × tree_multiplier(stage)
              × painting_bonus(paint_mastery, fame_skill_tree_modifiers)
```

Appliqué au rythme du `_process(delta)` ou d'un Timer dédié.

### Cible de pacing

L'arbre **millénaire** (dernier stade) doit être atteignable après ≈ 1 an de jeu régulier. Les premiers stades passent en quelques minutes, les derniers en semaines/mois. Courbe log-spaced dans `TreeStages.gd`.

## 5. Canvas & sous-mécaniques painting

### Canvas (core loop)

État machine : peint en cours → prêt à vendre → vendu (gain gold + paint_mastery) → nouveau canvas.

- Tier du canvas : upgradable (coûte gold) pour peindre des canvas plus chers.
- Output d'une vente : `gold = f(tier, multiplicateurs)` et `paint_mastery += g(tier, gold)`.

### Sous-mécaniques (toutes = multiplicateurs canvas, toutes payées en gold)

- **Workshop** : améliore les tiers/vitesse de canvas. Items craftables avec gold.
- **Inventory** : slots pour équiper des items craftés → multiplicateurs stat sur canvas.
- **Craft** : UI de création d'items (coût gold + éventuellement matériaux plus tard).
- **Painter office** : hire workers, ils automatisent la production de canvas (multiplicateur de throughput).

**MVP scope :** pas de currencies propres à ces mécaniques. Les items ne se vendent pas contre une ressource dans le MVP (hook prévu pour plus tard).

## 6. Ascend

### Palier et reward

- Coût : palier d'inspiration défini par `Balance.palier_ascend(ascend_count)`. Formule initiale indicative : `1000 × (2 ^ ascend_count)`. À tuner.
- Reward : `fame_gain = Balance.fame_conversion(inspiration_at_ascend)`. Formule initiale indicative : `floor(log10(inspi) × k)`. À tuner.

### Ce qui reset

- `inspiration`, `gold`
- État de l'arbre (stage, parts, upgrades) → retour au stade 0
- Canvas (tier, progression)
- Workshop (tier, items craftés non équipés)
- Inventory (tous les items supprimés — équipés ou non ; reset total du run)
- Painter office (workers licenciés)
- Sous-mécaniques débloquées → re-débloquées progressivement au prochain run

### Ce qui persiste

- `fame`, `paint_mastery`
- Skill tree (nodes achetés)
- Compteur d'ascends (pour formules)

### Orchestration

`Ascend.perform()` est l'unique point d'entrée du reset. Il appelle les `reset()` de chaque système concerné dans l'ordre correct, émet un signal `ascended(fame_gained, ascend_count)`, et laisse l'UI rafraîchir.

## 7. Paint mastery (courbe log)

Accumulée à chaque vente de canvas. Formule cible : `paint_mastery += Balance.pm_gain(canvas_tier, gold_earned)`, avec `pm_gain` dimensionné pour qu'au bout de 1-2 ans de jeu, le multiplicateur représente un boost "significatif" (ex. ×2-×5) mais pas game-breaking (ex. pas ×1000).

Multiplicateur appliqué : `painting_output_mult = 1 + Balance.pm_log_factor × log(paint_mastery + 1)`.

Courbe log garantit croissance douce : insignifiant early, important mid/late, pas explosif.

## 8. Skill tree (scope minimal au MVP)

Garde le rôle qu'il a aujourd'hui dans le code : nodes permanents achetés avec fame, chacun donne un bonus modeste et permanent (stat multipliers, unlocks mineurs). La **structure des nodes reste inchangée** pour le MVP — on re-spécifiera un skill tree plus ambitieux plus tard.

Un seul changement : la currency qui le paye = **fame** (et non plus `ascendancy_points`/`skill_points`).

## 9. Architecture

### Structure des fichiers

```
scripts/
├── autoloads/
│   ├── GameState.gd       # Hub de signals, accès aux systems
│   └── SceneManager.gd    # Load/unload des views
├── core/
│   ├── BigNumber.gd       # Nombre log-scale, overflow → cap (jamais 0)
│   ├── Formatter.gd       # Unique classe de formatage (K/M/B/T)
│   └── Balance.gd         # Toutes les constantes et formules de tuning
├── systems/
│   ├── Currency.gd        # 4 pools, add/spend/reset/get, signal changed
│   ├── InspirationTree.gd # Stades + parties + upgrades, tick passif
│   ├── Canvas.gd          # State machine peinture, vente → gold + pm
│   ├── Workshop.gd        # Tiers, crafting items
│   ├── Inventory.gd       # Items équipés, calcul multiplicateurs
│   ├── PainterOffice.gd   # Workers, automatisation canvas
│   ├── Ascend.gd          # Palier, conversion fame, orchestration reset
│   ├── SkillTree.gd       # Nodes permanents, spend fame
│   ├── PaintMastery.gd    # Accumulateur + courbe log
│   └── Save.gd            # Snapshot versionné atomique
├── config/
│   ├── TreeStages.gd      # 20-30 stades, data only
│   ├── CanvasTiers.gd     # Tiers de canvas
│   └── SkillTreeNodes.gd  # Nodes du skill tree
└── ui/
    ├── views/             # AccueilView, PaintingView, AscendancyView, SkillTreeView
    ├── popups/            # Canvas, Inventory, Craft, PainterOffice
    └── widgets/           # CurrencyDisplay, Tooltip, etc.
```

### Règles de frontières (non-négociables)

- `core/` ne dépend de rien. Utilitaires purs.
- `config/` ne dépend que de `core/`. Data only, pas de logic.
- `systems/` ne se parlent **jamais directement**. Toute communication passe par les signals de `GameState`.
- `ui/` ne connaît que `GameState` (signals en lecture, actions en écriture). Zéro logic de jeu dans les vues.
- Pas de cycle de dépendance possible par construction.

### Flux de communication

```
System A  ──emit──▶  GameState  ──signal──▶  System B
                         │
                         └─signal──▶  UI (affichage)
```

### Exemple : vente d'un canvas

```
Canvas.sell()
  ├─▶ GameState.canvas_sold(tier, gold_amount)
  │       ├─▶ Currency.add("gold", gold_amount)
  │       │       └─▶ UI currency_display refresh
  │       └─▶ PaintMastery.add_from_sale(tier, gold_amount)
  │               └─▶ InspirationTree.update_global_multiplier()
  │                       └─▶ UI tree_display refresh
  └─▶ Canvas._reset_to_new_canvas()
```

Chaque système est isolé, remplaçable, testable en unit.

## 10. Save system

### Principes

1. **Atomique** : écrire dans `user://artdle.save.tmp`, puis rename. Aucune save tronquée possible.
2. **Versionné** : chaque save porte `version: N`. `SAVE_VERSION = 1` au MVP.
3. **Migration chain** : fonction `_migrate(data, from_version, to_version)` testée, même si stub en v1.
4. **Fail loud** : save corrompue → erreur explicite, propose nouvelle partie. Jamais de load silencieux d'un state partiel.
5. **Symétrie** : chaque système a `serialize() → Dictionary` et `deserialize(data: Dictionary)`. Round-trip testé.

### Format

```json
{
  "version": 1,
  "currency":       { ... },
  "inspi_tree":     { ... },
  "canvas":         { ... },
  "workshop":       { ... },
  "inventory":      { ... },
  "painter_office": { ... },
  "skill_tree":     { ... },
  "ascend":         { ... },
  "paint_mastery":  { ... }
}
```

## 11. UI

### Règles générales

- Toutes les vues héritent de `BaseView.gd` (cycle `_initialize_view` / `_connect_view_signals` / `_initialize_ui`).
- Une vue ne modifie pas un system directement. Elle appelle `GameState.try_upgrade_tree_part("roots")` ou équivalent.
- Les widgets s'abonnent aux signals, ne polling pas.
- Les layouts `.tscn` existants (popups, views) sont **gardés comme référence visuelle** ; leurs scripts sont intégralement réécrits.

### Vues principales

- **AccueilView** : main panel. Centre = visuel arbre (SVG ou sprite selon stade). Droite = panneau des parties + boutons upgrade. Top = notifications "X possible, débloquer pour Y inspi".
- **PaintingView** : canvas central + bouton vendre. 4 boutons d'accès aux popups (workshop/inventory/craft/painter office).
- **AscendancyView** : affichage palier vs inspi courant, preview fame gain, bouton ascend + confirm modal.
- **SkillTreeView** : nodes depuis `config/SkillTreeNodes.gd`, spend fame.

### Widgets

- `CurrencyDisplay` : 1 widget par currency, abonné à `Currency.changed`.
- `Tooltip` : autonome, unique.
- **Pas de XP bar** (cut).

## 12. Testing

Framework : **GUT** (Godot Unit Test, plugin standard), installé dans `addons/gut/`.

### Unit tests (obligatoires)

| Module | Ce qu'on teste |
|---|---|
| `BigNumber` | Arithmétique, overflow → cap (pas 0), comparaisons, log-scale |
| `Formatter` | Sorties K/M/B/T, zéro/négatif, précision |
| `Balance` | Chaque formule (palier ascend, fame conversion, pm gain, pm multiplier) |
| `Currency` | `spend` atomique, `reset` préserve permanentes, signals émis |
| `Ascend.perform()` | Reset exactement les systems attendus, fame_gain = formule, count++ |
| `InspirationTree` | Transition de stade, cost d'upgrade progresse, `possibility_unlocked` émis |
| `Save` | Round-trip serialize→deserialize produit state identique, migration stub no-op |

### Checklist manuelle (par vue)

Une checklist maintenue à jour, vérifiée quand une session touche à cette vue :
- Affichage des currencies cohérent
- Boutons disabled quand insuffisant
- Signals UI → actions correctement routés
- Ascend visuellement complet (le joueur voit tout se reset sauf fame/skill tree/pm)
- Save → quit → relaunch → state identique

Pas de tests E2E UI automatisés au MVP : trop fragiles pour le ROI.

### Discipline

Toute nouvelle formule dans `Balance.gd` doit venir avec son test unitaire. C'est le cœur du feel du jeu ; bug = joueur perdu.

## 13. Ce qui est supprimé du code existant

Le rebuild remplace intégralement :

- Tout `scripts/` (28 fichiers .gd)
- Tout `views/` (4 scenes — layouts seulement gardés en réf)
- Tout `Scenes/` (popups — layouts gardés en réf)
- `Main.tscn`, `accueil_2d_view.tscn`, `alternateGuidingSpirit2d.tscn`
- Ancien save format

Sont gardés :

- `artdleAsset/`, `themes/`, `icon.svg`
- `project.godot`, `default_bus_layout.tres`
- `Gemini.md`, `GAME_MECHANICS_DOCUMENTATION.md`, `GAME_FLOW_DIAGRAM.md`, `TODO`
- Les `.tscn` de popups/vues **uniquement comme référence visuelle** (les scripts associés sont jetés)

## 14. Out of scope (MVP)

Explicitement **pas au MVP** — à rediscuter après que la base soit flawless :

- Nouvelles mécaniques d'art au-delà du canvas (sculpture, dessin, digital art, etc.)
- Vente d'items craftés contre une currency
- Currencies propres aux sous-mécaniques
- Endgame / prestige au-delà du premier niveau d'ascend
- Événements temporaires, achievements, quêtes
- Multi-joueur, cloud save, trading
- Animation/visuel avancé de l'arbre (on part sur un rendu simple : SVG/sprite par stade)
- Sound design complet (music existe, pas de SFX custom au MVP)
- Localisation autre que français
- Skill tree redesign (on garde la structure actuelle, seule la currency change)

## 15. Ambiguïtés / à tuner pendant l'implémentation

Valeurs à déterminer empiriquement et à centraliser dans `Balance.gd` :

- Nombre exact de stades de l'arbre (cible : 20-30).
- Courbe de coût gold pour les upgrades de parties.
- Seuils de gold cumulé pour franchir un stade (vs. "toutes parties max level").
- Formule `palier_ascend(count)` et `fame_conversion(inspi)`.
- `pm_gain(tier, gold)` et `pm_log_factor`.
- Liste exacte des stades qui débloquent chaque sous-mécanique (indicatif : stage 3 / 6 / 9).


## 16. Définition de "done" pour le MVP

Le MVP est livré quand :

1. Toutes les currencies fonctionnent selon le tableau (§3).
2. L'arbre d'inspiration affiche 3-5 stades testables (pas besoin des 20-30 au jour 1), avec parties/upgrades jouables et transitions de stade fonctionnelles.
3. Canvas + sous-mécaniques (workshop, inventory, craft, painter office) produisent et consomment correctement, avec unlocks progressifs via stade+inspi.
4. Ascend fonctionne : palier détecté, fame gagnée, reset correct, persistances correctes.
5. Paint mastery accumule et applique son multiplicateur log.
6. Skill tree dépense la fame, bonus appliqués.
7. Save/load atomique et versionné, round-trip testé.
8. Tous les unit tests passent.
9. Une partie complète (démarrer → quelques ascends → quit → reload → continue) se déroule sans bug.
