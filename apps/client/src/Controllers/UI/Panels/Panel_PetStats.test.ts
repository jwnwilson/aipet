import { Panel_PetStats, statColor } from './Panel_PetStats';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';

// ── statColor ──────────────────────────────────────────────────────────────

describe('statColor', () => {
    it('returns green for value below 0.4', () => {
        expect(statColor(0)).toBe('#4CAF50');
        expect(statColor(0.2)).toBe('#4CAF50');
        expect(statColor(0.39)).toBe('#4CAF50');
    });

    it('returns yellow for value between 0.4 and 0.7', () => {
        expect(statColor(0.4)).toBe('#FFC107');
        expect(statColor(0.55)).toBe('#FFC107');
        expect(statColor(0.69)).toBe('#FFC107');
    });

    it('returns red for value 0.7 and above', () => {
        expect(statColor(0.7)).toBe('#F44336');
        expect(statColor(0.85)).toBe('#F44336');
        expect(statColor(1.0)).toBe('#F44336');
    });
});

// ── helpers ────────────────────────────────────────────────────────────────

function makeEntities(petStats: Record<string, number> | null): Map<string, any> {
    const entities = new Map<string, any>();
    if (petStats !== null) {
        entities.set('bunny-1', {
            race: 'bunny',
            entity: { petStats },
        });
    }
    return entities;
}

// ── Panel_PetStats.update() ────────────────────────────────────────────────

describe('Panel_PetStats', () => {
    let playerUI: Rectangle;
    let panel: Panel_PetStats;

    beforeEach(() => {
        playerUI = new Rectangle('playerUI');
        panel = new Panel_PetStats(playerUI);
    });

    it('constructs without throwing', () => {
        expect(panel).toBeDefined();
    });

    it('update() does not throw when no bunny entity is present', () => {
        expect(() => panel.update(new Map())).not.toThrow();
    });

    it('update() does not throw when bunny entity is missing petStats', () => {
        const entities = new Map<string, any>();
        entities.set('bunny-1', { race: 'bunny', entity: {} });
        expect(() => panel.update(entities)).not.toThrow();
    });

    it('update() does not throw when entities map contains non-bunny entities', () => {
        const entities = new Map<string, any>();
        entities.set('player-1', { race: 'humanoid', entity: {} });
        expect(() => panel.update(entities)).not.toThrow();
    });

    it('update() sets bar fill width based on stat value', () => {
        const panel2 = new Panel_PetStats(playerUI) as any;
        panel2.update(makeEntities({ hunger: 0.5, boredom: 0, social: 0, toilet: 0, tiredness: 0 }));
        // hunger is index 0; width should be ~50%
        expect(panel2._statRows[0].fill.width).toBe('50%;');
    });

    it('update() clamps stat values to 0–1 range', () => {
        const panel2 = new Panel_PetStats(playerUI) as any;
        panel2.update(makeEntities({ hunger: 1.5, boredom: -0.2, social: 0, toilet: 0, tiredness: 0 }));
        expect(panel2._statRows[0].fill.width).toBe('100%;'); // hunger clamped to 1
        expect(panel2._statRows[1].fill.width).toBe('0%;');   // boredom clamped to 0
    });

    it('update() applies correct color for green stat (< 0.4)', () => {
        const panel2 = new Panel_PetStats(playerUI) as any;
        panel2.update(makeEntities({ hunger: 0.2, boredom: 0, social: 0, toilet: 0, tiredness: 0 }));
        expect(panel2._statRows[0].fill.background).toBe('#4CAF50');
    });

    it('update() applies correct color for yellow stat (0.4–0.7)', () => {
        const panel2 = new Panel_PetStats(playerUI) as any;
        panel2.update(makeEntities({ hunger: 0.55, boredom: 0, social: 0, toilet: 0, tiredness: 0 }));
        expect(panel2._statRows[0].fill.background).toBe('#FFC107');
    });

    it('update() applies correct color for red stat (>= 0.7)', () => {
        const panel2 = new Panel_PetStats(playerUI) as any;
        panel2.update(makeEntities({ hunger: 0.9, boredom: 0, social: 0, toilet: 0, tiredness: 0 }));
        expect(panel2._statRows[0].fill.background).toBe('#F44336');
    });

    it('update() updates all five stat rows independently', () => {
        const panel2 = new Panel_PetStats(playerUI) as any;
        panel2.update(makeEntities({
            hunger:    0.1,
            boredom:   0.5,
            social:    0.8,
            toilet:    0.3,
            tiredness: 0.65,
        }));
        expect(panel2._statRows[0].fill.background).toBe('#4CAF50'); // hunger green
        expect(panel2._statRows[1].fill.background).toBe('#FFC107'); // boredom yellow
        expect(panel2._statRows[2].fill.background).toBe('#F44336'); // social red
        expect(panel2._statRows[3].fill.background).toBe('#4CAF50'); // toilet green
        expect(panel2._statRows[4].fill.background).toBe('#FFC107'); // tiredness yellow
    });
});
