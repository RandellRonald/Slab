import { ArrowUpRight, BadgeCheck, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";

import excavatorEquipmentImage from "../../assets/slab-excavator-category.png";
import jcbEquipmentImage from "../../assets/slab-jcb-category.png";
import craneEquipmentImage from "../../assets/slab-crane-category.png";
import tipperEquipmentImage from "../../assets/slab-tipper-category.png";

import "./equipment-category.css";

export type EquipmentCategory = {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  capability: string;
  availability: string;
  marketplaceCategory: string;
  visual: "excavator" | "jcb" | "crane" | "tipper" | "septic";
};

const visualSources: Partial<Record<EquipmentCategory["visual"], string>> = {
  excavator: excavatorEquipmentImage,
  jcb: jcbEquipmentImage,
  crane: craneEquipmentImage,
  tipper: tipperEquipmentImage
};

export function EquipmentCategoryCard({ category }: { category: EquipmentCategory }) {
  return (
    <Link
      aria-label={`View providers for ${category.title}`}
      className={`slab-category-card slab-category-card--${category.visual}`}
      to={`/equipment/${category.marketplaceCategory}`}
    >
      <div aria-hidden="true" className="slab-category-card__visual">
        {category.visual === "septic" ? <div className="slab-category-card__septic-visual"><span /><span /><span /></div> : <img alt="" src={visualSources[category.visual]} />}
      </div>
      <div className="slab-category-card__content">
        <div className="slab-category-card__eyebrow">
          <span>{category.number}</span>
          <span>{category.eyebrow}</span>
        </div>
        <h3>{category.title}</h3>
        <p>{category.description}</p>
        <div className="slab-category-card__indicators">
          <span><BadgeCheck size={15} strokeWidth={2.3} />{category.capability}</span>
          <span><Clock3 size={15} strokeWidth={2.3} />{category.availability}</span>
        </div>
        <div className="slab-category-card__action">
          <span>View Providers</span>
          <span aria-hidden="true" className="slab-category-card__arrow"><ArrowUpRight size={19} strokeWidth={2.4} /></span>
        </div>
      </div>
    </Link>
  );
}
