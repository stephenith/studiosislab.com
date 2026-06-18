/* AUTO-GENERATED FILE. DO NOT EDIT MANUALLY. */
/* Generated from templates.manifest.json by scripts/templates/generate.ts */
import tpl0 from "./template-json/t001.json";
import tpl1 from "./template-json/t002.json";
import tpl2 from "./template-json/t003.json";
import tpl3 from "./template-json/t004.json";
import tpl4 from "./template-json/t005.json";
import tpl5 from "./template-json/t006.json";
import tpl6 from "./template-json/t007.json";
import tpl7 from "./template-json/t008.json";
import tpl8 from "./template-json/t009.json";
import tpl9 from "./template-json/t010.json";
import tpl10 from "./template-json/t011.json";
import tpl11 from "./template-json/t012.json";
import tpl12 from "./template-json/t013.json";
import tpl13 from "./template-json/t014.json";
import tpl14 from "./template-json/t015.json";
import tpl15 from "./template-json/t016.json";
import tpl16 from "./template-json/t017.json";
import tpl17 from "./template-json/t018.json";
import tpl18 from "./template-json/t019.json";
import tpl19 from "./template-json/t020.json";
import tpl20 from "./template-json/t021.json";
import tpl21 from "./template-json/t022.json";
import tpl22 from "./template-json/t023.json";
import tpl23 from "./template-json/t024.json";
import tpl24 from "./template-json/t025.json";
import tpl25 from "./template-json/t026.json";
import tpl26 from "./template-json/t027.json";
import tpl27 from "./template-json/t028.json";
import tpl28 from "./template-json/t029.json";
import tpl29 from "./template-json/t030.json";
import tpl30 from "./template-json/t031.json";
import tpl31 from "./template-json/t032.json";
import tpl32 from "./template-json/t033.json";
import tpl33 from "./template-json/t034.json";
import tpl34 from "./template-json/t035.json";
import tpl35 from "./template-json/t036.json";
import tpl36 from "./template-json/t037.json";
import tpl37 from "./template-json/t038.json";
import tpl38 from "./template-json/t039.json";
import tpl39 from "./template-json/t040.json";
import tpl40 from "./template-json/t041.json";
import tpl41 from "./template-json/t042.json";
import tpl42 from "./template-json/t043.json";
import tpl43 from "./template-json/t044.json";
import tpl44 from "./template-json/t045.json";
import tpl45 from "./template-json/t046.json";
import tpl46 from "./template-json/t047.json";
import tpl47 from "./template-json/t048.json";
import tpl48 from "./template-json/t049.json";
import tpl49 from "./template-json/t050.json";
import tpl50 from "./template-json/t051.json";
import tpl51 from "./template-json/t052.json";
import tpl52 from "./template-json/t053.json";
import tpl53 from "./template-json/t054.json";
import tpl54 from "./template-json/t055.json";
import tpl55 from "./template-json/t056.json";
import tpl56 from "./template-json/t057.json";
import tpl57 from "./template-json/t058.json";
import tpl58 from "./template-json/t059.json";
import tpl59 from "./template-json/t060.json";
import tpl60 from "./template-json/t061.json";
import tpl61 from "./template-json/t062.json";
import tpl62 from "./template-json/t063.json";
import tpl63 from "./template-json/t064.json";
import tpl64 from "./template-json/t065.json";
import tpl65 from "./template-json/t066.json";
import tpl66 from "./template-json/t067.json";
import tpl67 from "./template-json/t068.json";
import tpl68 from "./template-json/t069.json";
import tpl69 from "./template-json/t070.json";
import tpl70 from "./template-json/t071.json";
import tpl71 from "./template-json/t072.json";
import tpl72 from "./template-json/t073.json";
import tpl73 from "./template-json/t074.json";
import tpl74 from "./template-json/t075.json";
import tpl75 from "./template-json/t076.json";
import tpl76 from "./template-json/t077.json";
import tpl77 from "./template-json/t078.json";
import tpl78 from "./template-json/t079.json";

export type TemplateSnapshot = {
  objects: any[];
};

function toTemplateSnapshot(raw: unknown): TemplateSnapshot {
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first && typeof first === "object" && Array.isArray((first as { objects?: unknown[] }).objects)) {
      return { objects: (first as { objects: any[] }).objects };
    }
    return { objects: [] };
  }
  if (raw && typeof raw === "object" && Array.isArray((raw as { objects?: unknown[] }).objects)) {
    return { objects: (raw as { objects: any[] }).objects };
  }
  return { objects: [] };
}

export const TEMPLATE_SNAPSHOTS: Record<string, TemplateSnapshot> = {
  blank: { objects: [] },
  "t001": toTemplateSnapshot(tpl0),
  "t002": toTemplateSnapshot(tpl1),
  "t003": toTemplateSnapshot(tpl2),
  "t004": toTemplateSnapshot(tpl3),
  "t005": toTemplateSnapshot(tpl4),
  "t006": toTemplateSnapshot(tpl5),
  "t007": toTemplateSnapshot(tpl6),
  "t008": toTemplateSnapshot(tpl7),
  "t009": toTemplateSnapshot(tpl8),
  "t010": toTemplateSnapshot(tpl9),
  "t011": toTemplateSnapshot(tpl10),
  "t012": toTemplateSnapshot(tpl11),
  "t013": toTemplateSnapshot(tpl12),
  "t014": toTemplateSnapshot(tpl13),
  "t015": toTemplateSnapshot(tpl14),
  "t016": toTemplateSnapshot(tpl15),
  "t017": toTemplateSnapshot(tpl16),
  "t018": toTemplateSnapshot(tpl17),
  "t019": toTemplateSnapshot(tpl18),
  "t020": toTemplateSnapshot(tpl19),
  "t021": toTemplateSnapshot(tpl20),
  "t022": toTemplateSnapshot(tpl21),
  "t023": toTemplateSnapshot(tpl22),
  "t024": toTemplateSnapshot(tpl23),
  "t025": toTemplateSnapshot(tpl24),
  "t026": toTemplateSnapshot(tpl25),
  "t027": toTemplateSnapshot(tpl26),
  "t028": toTemplateSnapshot(tpl27),
  "t029": toTemplateSnapshot(tpl28),
  "t030": toTemplateSnapshot(tpl29),
  "t031": toTemplateSnapshot(tpl30),
  "t032": toTemplateSnapshot(tpl31),
  "t033": toTemplateSnapshot(tpl32),
  "t034": toTemplateSnapshot(tpl33),
  "t035": toTemplateSnapshot(tpl34),
  "t036": toTemplateSnapshot(tpl35),
  "t037": toTemplateSnapshot(tpl36),
  "t038": toTemplateSnapshot(tpl37),
  "t039": toTemplateSnapshot(tpl38),
  "t040": toTemplateSnapshot(tpl39),
  "t041": toTemplateSnapshot(tpl40),
  "t042": toTemplateSnapshot(tpl41),
  "t043": toTemplateSnapshot(tpl42),
  "t044": toTemplateSnapshot(tpl43),
  "t045": toTemplateSnapshot(tpl44),
  "t046": toTemplateSnapshot(tpl45),
  "t047": toTemplateSnapshot(tpl46),
  "t048": toTemplateSnapshot(tpl47),
  "t049": toTemplateSnapshot(tpl48),
  "t050": toTemplateSnapshot(tpl49),
  "t051": toTemplateSnapshot(tpl50),
  "t052": toTemplateSnapshot(tpl51),
  "t053": toTemplateSnapshot(tpl52),
  "t054": toTemplateSnapshot(tpl53),
  "t055": toTemplateSnapshot(tpl54),
  "t056": toTemplateSnapshot(tpl55),
  "t057": toTemplateSnapshot(tpl56),
  "t058": toTemplateSnapshot(tpl57),
  "t059": toTemplateSnapshot(tpl58),
  "t060": toTemplateSnapshot(tpl59),
  "t061": toTemplateSnapshot(tpl60),
  "t062": toTemplateSnapshot(tpl61),
  "t063": toTemplateSnapshot(tpl62),
  "t064": toTemplateSnapshot(tpl63),
  "t065": toTemplateSnapshot(tpl64),
  "t066": toTemplateSnapshot(tpl65),
  "t067": toTemplateSnapshot(tpl66),
  "t068": toTemplateSnapshot(tpl67),
  "t069": toTemplateSnapshot(tpl68),
  "t070": toTemplateSnapshot(tpl69),
  "t071": toTemplateSnapshot(tpl70),
  "t072": toTemplateSnapshot(tpl71),
  "t073": toTemplateSnapshot(tpl72),
  "t074": toTemplateSnapshot(tpl73),
  "t075": toTemplateSnapshot(tpl74),
  "t076": toTemplateSnapshot(tpl75),
  "t077": toTemplateSnapshot(tpl76),
  "t078": toTemplateSnapshot(tpl77),
  "t079": toTemplateSnapshot(tpl78),
};
