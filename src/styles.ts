/**
 * The four looks are CSS over the same geometry. Per panel the scene sets
 *   --f          a tone mixed between the lit (--_l*) and shadowed (--_s*) colour
 *   .front/.back which side of the paper faces the viewer
 * and draws: fill (.f), paper grain (.t), crease memory (.m), active-fold hint (.a), edges (.e).
 */
export const STYLE = /* css */ `
:host{display:inline-block;width:160px;height:160px;vertical-align:middle;contain:layout paint style;
--_ink:var(--ol-ink,#17171a);--_bg:var(--ol-bg,#fff);--_paper:var(--ol-paper,#fffefb);--_sw:var(--ol-stroke,1.5px);
--_front:var(--ol-front,#e2553a);--_back:var(--ol-back,#f6f3ec);
--_shade:color-mix(in oklab,var(--_ink) 13%,var(--_paper));
--_hi:var(--_bg);--_lo:color-mix(in oklab,var(--_ink) 26%,var(--_bg));--_bk:color-mix(in oklab,var(--_ink) 7%,var(--_bg));
--_grain:.9}
:host([theme=dark]){--_ink:var(--ol-ink,#f2f2f0);--_bg:var(--ol-bg,#0f0f11);--_paper:var(--ol-paper,#19191c);
--_shade:color-mix(in oklab,#000 50%,var(--_paper));
--_hi:color-mix(in oklab,var(--_ink) 30%,var(--_bg));--_lo:color-mix(in oklab,var(--_ink) 7%,var(--_bg));--_bk:color-mix(in oklab,var(--_ink) 18%,var(--_bg));
--_grain:.55}
@media (prefers-color-scheme:dark){:host(:not([theme=light])){--_ink:var(--ol-ink,#f2f2f0);--_bg:var(--ol-bg,#0f0f11);--_paper:var(--ol-paper,#19191c);
--_shade:color-mix(in oklab,#000 50%,var(--_paper));
--_hi:color-mix(in oklab,var(--_ink) 30%,var(--_bg));--_lo:color-mix(in oklab,var(--_ink) 7%,var(--_bg));--_bk:color-mix(in oklab,var(--_ink) 18%,var(--_bg));
--_grain:.55}}
svg{display:block;width:100%;height:100%;overflow:visible}
path{vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round;fill:none}
.f{fill:var(--f);stroke:var(--f);stroke-width:1px}
.t{stroke:none;opacity:var(--_grain);pointer-events:none}
[data-tex=off] .t,[data-tex=loading] .t{display:none}
.e{stroke:var(--_ink);stroke-width:var(--_sw)}
.m{stroke:var(--_ink);stroke-opacity:.22;stroke-width:calc(var(--_sw)*.55)}
.a{display:none}

[data-look=ink]{--_lf:var(--_paper);--_sf:var(--_shade);--_lb:var(--_paper);--_sb:var(--_shade)}

[data-look=blueprint]{--_lf:var(--_ink);--_sf:var(--_ink);--_lb:var(--_ink);--_sb:var(--_ink)}
[data-look=blueprint] .f{fill-opacity:.045;stroke:none}
[data-look=blueprint] .t{display:none}
[data-look=blueprint] .e{stroke-width:calc(var(--_sw)*.85)}
[data-look=blueprint] .back .e{stroke-opacity:.5}
[data-look=blueprint] .m{stroke-opacity:.2}
[data-look=blueprint] .a{display:inline;stroke:var(--_ink);stroke-opacity:.7;stroke-width:calc(var(--_sw)*.75);stroke-dasharray:.07 .05}

[data-look=graphite]{--_lf:var(--_hi);--_sf:var(--_lo);--_lb:color-mix(in oklab,var(--_hi) 80%,var(--_bk));--_sb:color-mix(in oklab,var(--_lo) 70%,var(--_bk))}
[data-look=graphite] .e{stroke-opacity:.85;stroke-width:calc(var(--_sw)*.8)}

[data-look=paper]{--_lf:var(--_front);--_sf:color-mix(in oklab,var(--_front) 68%,#1a0f0c);--_lb:var(--_back);--_sb:color-mix(in oklab,var(--_back) 82%,#6f6a60);--_grain:.7}
[data-look=paper] .e{stroke:#000;stroke-opacity:.28;stroke-width:calc(var(--_sw)*.55)}
[data-look=paper] .m{stroke:#000;stroke-opacity:.12;stroke-width:calc(var(--_sw)*.5)}
`;
