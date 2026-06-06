import { Control } from "@babylonjs/gui/2D/controls/control";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { generatePanel } from "../Theme";

const STAT_LABELS: string[] = ["Hunger", "Boredom", "Social", "Toilet", "Tired"];
const STAT_KEYS: string[] = ["hunger", "boredom", "social", "toilet", "tiredness"];

const STAT_COLOR_LOW    = "#4CAF50"; // green  — stat < 0.4
const STAT_COLOR_MID    = "#FFC107"; // yellow — stat 0.4–0.7
const STAT_COLOR_HIGH   = "#F44336"; // red    — stat > 0.7
const BAR_BG_COLOR      = "rgba(255,255,255,0.15)";
const PANEL_WIDTH_PX    = 185;
const PANEL_HEIGHT_PX   = 185;
const BAR_WIDTH_PX      = 105;
const BAR_HEIGHT_PX     = 10;
const ROW_HEIGHT_PX     = 28;

export function statColor(value: number): string {
    if (value < 0.4) return STAT_COLOR_LOW;
    if (value < 0.7) return STAT_COLOR_MID;
    return STAT_COLOR_HIGH;
}

interface StatRow {
    fill: Rectangle;
}

export class Panel_PetStats {
    private _panel: Rectangle;
    private _statRows: StatRow[] = [];
    private _noDataText: TextBlock;

    constructor(playerUI: Rectangle) {
        this._panel = generatePanel(
            "petStats",
            `${PANEL_WIDTH_PX}px;`,
            `${PANEL_HEIGHT_PX}px`,
            "10px",
            "10px"
        );
        this._panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP;
        this._panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        playerUI.addControl(this._panel);

        this._buildUI();
    }

    private _buildUI(): void {
        const title = new TextBlock("petStats_title", "Bunny Stats");
        title.color  = "#FFFFFF";
        title.fontSize = "13px;";
        title.fontWeight = "bold";
        title.height = "22px;";
        title.top = "6px";
        title.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP;
        title.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this._panel.addControl(title);

        const stack = new StackPanel("petStats_stack");
        stack.isVertical = true;
        stack.top = "28px";
        stack.left = "0px";
        stack.width = "100%";
        stack.height = `${ROW_HEIGHT_PX * STAT_LABELS.length}px;`;
        stack.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP;
        stack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this._panel.addControl(stack);

        STAT_LABELS.forEach((label) => {
            const row = new StackPanel(`row_${label}`);
            row.isVertical = false;
            row.height = `${ROW_HEIGHT_PX}px;`;
            row.paddingLeft = "8px";
            row.paddingRight = "8px";
            stack.addControl(row);

            const labelText = new TextBlock(`label_${label}`, label);
            labelText.color  = "#CCCCCC";
            labelText.fontSize = "11px;";
            labelText.width = "62px;";
            labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            row.addControl(labelText);

            const barOuter = new Rectangle(`barOuter_${label}`);
            barOuter.width     = `${BAR_WIDTH_PX}px;`;
            barOuter.height    = `${BAR_HEIGHT_PX}px;`;
            barOuter.background = BAR_BG_COLOR;
            barOuter.thickness = 1;
            barOuter.color     = "rgba(255,255,255,0.3)";
            barOuter.cornerRadius = 2;
            row.addControl(barOuter);

            const barFill = new Rectangle(`barFill_${label}`);
            barFill.width      = "0px;";
            barFill.height     = "1";
            barFill.background = STAT_COLOR_LOW;
            barFill.thickness  = 0;
            barFill.cornerRadius = 2;
            barFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            barOuter.addControl(barFill);

            this._statRows.push({ fill: barFill });
        });

        const noData = new TextBlock("petStats_noData", "No bunny found");
        noData.color   = "#888888";
        noData.fontSize = "11px;";
        noData.isVisible = false;
        this._panel.addControl(noData);
        this._noDataText = noData;
    }

    public update(entities: Map<string, any>): void {
        let bunnyEntity: any = null;
        entities.forEach((entity) => {
            if (!bunnyEntity && entity.race === "bunny") {
                bunnyEntity = entity;
            }
        });

        if (!bunnyEntity?.entity?.petStats) {
            this._noDataText.isVisible = true;
            return;
        }

        this._noDataText.isVisible = false;
        const petStats = bunnyEntity.entity.petStats;

        STAT_KEYS.forEach((key, i) => {
            const value: number = petStats[key] ?? 0;
            const clampedValue  = Math.max(0, Math.min(1, value));
            const fill          = this._statRows[i].fill;

            // width as percentage of outer bar
            const widthPct = Math.round(clampedValue * 100);
            fill.width     = `${widthPct}%;`;
            fill.background = statColor(clampedValue);
        });
    }
}
