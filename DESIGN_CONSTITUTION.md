# Design Constitution - Humanresetlab

## 1. Interactieve Componenten & Micro-interacties
Elk interactief element (knoppen, links, CTA's) binnen de projecten van Humanresetlab moet verplicht voldoen aan de onderstaande vier staten (states), gebruikmakend van moderne CSS transitions en hardware-accelerated transforms.

### Hover State (Zweefstatus)
- **Techniek:** Moet een subtiele, vloeiende overgang zijn via een CSS `transition` (`all 0.2s ease-in-out`).
- **Gedrag:** Bij het zweven met de muis verandert de achtergrondkleur of krijgt het element een zachte schaduw (`box-shadow`).

### Active State (Indrukken / Click-effect)
- **Techniek:** Maak gebruik van de CSS pseudo-klasse `:active` in combinatie met `transform: scale()`.
- **Gedrag:** Op het exacte moment van klikken moet de knop visueel **meeveeren**. Gebruik hiervoor `transform: scale(0.96);` of `transform: translateY(1px);`. Dit geeft directe fysieke feedback.

### Loading State (Laadstatus bij acties zoals Downloads)
- **Techniek:** Zodra een download of verwerking start, krijgt het element de status `disabled` en een geanimeerde CSS spinner binnenin de knop.
- **Gedrag:** De tekst verandert tijdelijk naar "Laden..." of verdwijnt voor een spinner. De cursor verandert naar `not-allowed`.

### Focus State (Toegankelijkheid)
- **Techniek:** CSS `:focus-visible`.
- **Gedrag:** Bij toetsenbordnavigatie (Tab) moet het element een duidelijke, contrasterende outline (focusring) krijgen conform de WCAG-normen.
