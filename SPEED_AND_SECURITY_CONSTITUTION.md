# Speed & Security Constitution — Humanresetlab

**Bestandsnaam:** `SPEED_AND_SECURITY_CONSTITUTION.md`  
**Versie:** 1.1  
**Scope:** alle repositories van Humanresetlab  
**Stack:** Next.js / React / TypeScript, Vercel en Supabase PostgreSQL, waaronder self-hosting op een VPS.

## 1. Uitgangspunt

Elke optimalisatie moet aantoonbaar bijdragen aan snelheid, efficiëntie of responsiviteit, met behoud van correctheid, toegankelijkheid, autorisatie en tenantisolatie.

Deze grondwet geldt voor menselijke ontwikkelaars en AI-codeagents, waaronder GPT-6.1.

Regels worden toegepast op de technologie die een repository daadwerkelijk gebruikt. Het document verplicht geen migratie naar Vercel, Supabase of een nieuwe databaseclient.

Bestaande afwijkingen worden geregistreerd en gericht opgelost. Het toevoegen van deze grondwet bewijst niet dat een project al aan alle regels voldoet.

## 2. Netwerk en uitvoerlocatie

Database-intensieve Vercel Functions draaien in een regio met lage gemeten latency naar de gebruikte database/API.

Meet vanuit de uitvoerregio van de functie. Geografische nabijheid alleen is onvoldoende: netwerkroutering en verbindingsopbouw tellen mee.

Voorbeeld, uitsluitend wanneer Frankfurt aantoonbaar passend is:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["fra1"]
}
```

Voeg dit samen met bestaande configuratie; overschrijf geen andere instellingen.

Statische pagina’s en assets blijven via de CDN beschikbaar. Extra functieregio’s worden alleen toegevoegd wanneer dit meetbaar helpt en binnen het databasebudget past.

Een functie die TCP PostgreSQL gebruikt, draait in een geschikte runtime. Voor onze Next.js-projecten is Node.js de standaard.

## 3. Databaseverbindingen en Supavisor

### 3.1 Verbindingsroutes

| Gebruik | Route |
|---|---|
| Supabase-client, Auth, Storage en Data API | HTTPS via de Supabase API |
| Directe SQL vanuit kortdurende Vercel Functions | Supavisor transaction pooling |
| Migraties, backups en sessiegebonden tooling | Gecontroleerde directe of geschikte sessieverbinding |

De URL voor `createClient()` is een HTTPS-API-adres, geen PostgreSQL connection string.

Voeg geen directe SQL-client toe uitsluitend om pooling te activeren. De bestaande API-route beheert databaseverbindingen aan de backendzijde.

### 3.2 Transaction pooling

Voor self-hosted Supavisor is **6543 de standaardpoort voor transaction pooling**. Controleer de werkelijke poortmapping en poolerconfiguratie.

Configuratiesjabloon voor een afzonderlijk ingerichte applicatierol:

```dotenv
# Alleen server-side secrets; alle waarden zijn placeholders.
DATABASE_URL="postgresql://app_runtime.POOLER_TENANT_ID:URL_ENCODED_PASSWORD@pooler.example.com:6543/postgres?sslmode=verify-full"
```

Verplicht:

- De applicatierol bestaat, heeft minimale rechten en wordt door de pooler ondersteund.
- `POOLER_TENANT_ID` is de Supavisor-routeringsidentifier, niet automatisch de zakelijke `tenant_id`.
- Speciale tekens in credentials zijn URL-geëncodeerd.
- Certificaat, hostname en vertrouwde CA worden correct gevalideerd.
- Geen `rejectUnauthorized: false` als oplossing voor certificaatproblemen.
- Geen databasecredentials in `NEXT_PUBLIC_`, repositories of logs.
- Bereikbaarheid en TLS worden vanuit Vercel gecontroleerd.
- Een HTTPS reverse proxy wordt niet verondersteld ook PostgreSQL TCP-verkeer af te handelen.

Transaction pooling ondersteunt geen blijvende sessiestatus. Schakel prepared statements uit volgens de gebruikte driver. Gebruik geen sessiegebonden instellingen, listeners of locks die over transacties heen moeten blijven bestaan.

Optioneel voorbeeld voor een repository die Postgres.js bewust toevoegt:

```ts
import "server-only";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ontbreekt");

export const sql = postgres(databaseUrl, {
  prepare: false,
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
});
```

Dit is een startconfiguratie. Controleer TLS-gedrag en timeouts tegen de geïnstalleerde driverversie.

Maak de client op moduleniveau en hergebruik deze binnen de runtime. Maak niet per query een nieuwe pool. Elke runtime-instantie heeft haar eigen pool.

Directe SQL neemt Supabase Auth/RLS-context niet vanzelf over. Configureer gebruikerscontext, tenantcontext en databaseprivileges expliciet. Gebruik geen superuser of `BYPASSRLS` voor gewone gebruikersacties.

### 3.3 Gezamenlijk VPS-verbindingsbudget

Alle projecten delen de capaciteit van de VPS.

Het budget omvat applicaties, PostgREST, Auth, Storage, Realtime, Supavisor, beheer en onderhoud.

Houd rekening met meerdere pools per database/rol en meerdere Vercel-instanties. Een poollimiet per repository begrenst het gezamenlijke verbruik niet.

Vergroot `max_connections` of poolgroottes uitsluitend na meting van geheugen, CPU, wachttijden en gelijktijdig gebruik. Leg een operationele reserve vast.

## 4. Queries en datavolume

Applicatiequeries selecteren uitsluitend benodigde kolommen.

Verboden bij applicatiedata:

```ts
.select("*")
.select()
.select("id, customers(*)")
```

Gebruik expliciete projecties:

```ts
.select("id, starts_at, status, customers(id, first_name, last_name)")
```

Gewone interactieve lijstendpoints leveren maximaal **50 records per pagina**. De server valideert en begrenst de paginagrootte.

Elke lijst heeft een deterministische sortering met een unieke tie-breaker. Gebruik bij grote of snel veranderende datasets bij voorkeur cursorpaginering.

Voorbeeld voor een aflopende UUID-lijst:

```ts
// tenantId komt uit geverifieerde servercontext.
// beforeId wordt vooraf als geldige UUID gevalideerd.
let query = supabase
  .from("customers")
  .select("id, first_name, last_name")
  .eq("tenant_id", tenantId)
  .order("id", { ascending: false })
  .limit(50);

if (beforeId) query = query.lt("id", beforeId);

const { data, error } = await query;
if (error) throw error;

const rows = data ?? [];
const nextCursor =
  rows.length === 50 ? rows[rows.length - 1].id : null;
```

Dit sorteert op ID, niet op aanmaakdatum. Gebruik voor tijdlijnen bijvoorbeeld `(created_at, id)` als samengestelde cursor. Een volle pagina kan hier één extra, lege vervolgaanvraag veroorzaken.

Aanvullende regels:

- Pas tenantfilters én correcte RLS toe.
- Begrens geneste relaties en grote JSON-/tekstvelden.
- Vermijd N+1-queries en onnodige exacte tellingen.
- Voer onafhankelijke queries parallel uit met begrensde concurrency.
- Bereken dashboardtotalen in de database.
- Toon fouten als fouten, niet als lege lijsten of ontbrekende configuratie.
- Gebruik gepagineerde zoekselecties voor groeiende klant- en medewerkerlijsten.

Agenda’s moeten alle relevante afspraken binnen het gekozen tijdvenster kunnen tonen. Gebruik paginering of een expliciet begrensd agenda-endpoint; kap nooit stilzwijgend af op 50.

Exports en achtergrondtaken verwerken data in begrensde batches. Elke uitzondering vermeldt doel, maximaal bereik, timeout en verantwoordelijke.

## 5. Multi-Tenant Rolgebaseerde Security — RBAC & Gescheiden Ingangen

### 5.1 Gescheiden omgevingen

Admins, medewerkers en klanten krijgen afzonderlijke ingangen, routegroepen, layouts en autorisatiegrenzen.

Voorbeeld:

```text
/admin/login       → /admin/...
/medewerker/login  → /medewerker/...
/klant/login       → /klant/...
```

Bestaande gelijkwaardige routes mogen behouden blijven.

Administratieve schermen, bevoegdheden en mutatiehandlers worden niet via klantcomponenten of klantroutes aangeboden.

Generieke presentatiecomponenten, zoals knoppen en invoervelden, mogen worden gedeeld. Componenten die administratieve data of bevoegdheden ontsluiten blijven gescheiden.

Elke Server Action, API-route en datatoegang controleert zelfstandig de vereiste rechten. Verborgen knoppen, URL-scheiding en middleware vervangen deze controles niet.

### 5.2 Rollen en tenantlidmaatschap

`app_metadata.role` bevat een door vertrouwde servercode beheerde rol. Gebruik nooit `user_metadata`, formulierwaarden, URL-parameters of lokale browserstate als autorisatiebron.

Een rol alleen geeft geen toegang tot alle tenants.

Elke toegangsbeslissing combineert:

- Geverifieerde gebruikersidentiteit.
- Toegestane rol.
- Actief lidmaatschap van de betreffende tenant.
- Rechten op de specifieke handeling en records.
- Voor admins en medewerkers: vereiste MFA-status.

Bij meerdere rollen per tenant is een serverbeheerde membershiptabel de autoritatieve bron. Een globale rolclaim vervangt deze tenantgebonden rechten niet.

Rolclaims kunnen verouderd zijn tot tokenvernieuwing. Kritieke acties controleren daarom ook de actuele membership- en accountstatus. Supabase onderscheidt hiervoor vertrouwde `app_metadata` van door gebruikers wijzigbare `user_metadata`. Zie [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

### 5.3 Databasebescherming

Alle tabellen die gebruikers- of tenantdata via de Data API aanbieden hebben RLS en expliciete policies.

Policies beschermen `SELECT`, `INSERT`, `UPDATE` en `DELETE` afzonderlijk:

- `USING` begrenst bestaande toegankelijke records.
- `WITH CHECK` begrenst nieuwe en gewijzigde waarden.
- Updates mogen records niet naar een onbevoegde tenant verplaatsen.
- Klanten krijgen uitsluitend de eigen toegestane gegevens.
- Medewerkers krijgen uitsluitend toegewezen bevoegdheden.
- Tenantadmins krijgen uitsluitend toegang binnen hun tenant.

Controleer bestaande permissieve policies: een ruimere policy mag een strengere policy niet onbedoeld omzeilen.

Storage, Realtime, views en RPC’s krijgen overeenkomstige toegangsbeperkingen. Views gebruiken waar passend `security_invoker`; geprivilegieerde functies worden expliciet afgeschermd.

`service_role` en superuserverbindingen kunnen RLS omzeilen. Reserveer deze voor gecontroleerde beheer- en systeemtaken, met afzonderlijke autorisatie en auditregistratie. Gebruik ze niet als standaardroute voor backofficegebruikers.

## 6. Smart MFA & 30-Dagen Trusted Devices

### 6.1 Verplichte MFA

Admins en medewerkers gebruiken Supabase MFA met een Authenticator via TOTP.

Privileged toegang vereist een geverifieerde Supabase-sessie met `aal2`. Enrollment- en verificatieschermen zijn de noodzakelijke uitzondering om dit niveau te bereiken.

MFA wordt afgedwongen op server- en databaseniveau, niet alleen door een frontendprompt.

### 6.2 Vertrouwd apparaat

Na succesvolle TOTP-verificatie kan het systeem het betreffende browserprofiel maximaal **30 dagen** vertrouwen.

De server registreert minimaal:

- Gebruiker en geverifieerde sessie.
- Hash van een cryptografisch willekeurig device-token.
- Tijdstip van MFA-verificatie en absolute vervaldatum.
- Intrekkingsstatus.
- Beperkte apparaat- en netwerksignalen voor risicobeoordeling.

Het cookie bevat uitsluitend het ondoorzichtige token, geen rol, TOTP-secret of persoonsgegevens.

Voorbeeld van cookie-attributen:

```ts
cookieStore.set("__Host-trusted_device", opaqueToken, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
});
```

Gebruik geen `Domain`-attribuut. Het cookie wordt uitsluitend via HTTPS uitgegeven door de server.

De server controleert tokenhash, gebruiker, sessie, vervaldatum en intrekking. Verleng vertrouwen niet stilzwijgend voorbij 30 dagen zonder nieuwe MFA-verificatie.

### 6.3 Geen onnodige herhaalprompts

Binnen de vertrouwensperiode verschijnt geen nieuwe MFA-prompt zolang:

- De eerder met MFA bevestigde sessie geldig of veilig vernieuwbaar is.
- Het device-record geldig en niet ingetrokken is.
- De gebruiker nog de vereiste rechten heeft.
- Er geen concrete aanleiding voor herverificatie bestaat.

Behoud de sessie via de ondersteunde Supabase-refreshflow. Maak niet bij iedere navigatie een nieuwe login aan.

Een trusted-device-cookie verhoogt een nieuwe `aal1`-sessie niet naar `aal2`. Wanneer de eerdere sessie niet veilig kan worden voortgezet, volgt opnieuw TOTP-verificatie. Access tokens blijven kortlevend; 30 dagen vertrouwen betekent geen JWT met een looptijd van 30 dagen. Zie [Supabase User sessions](https://supabase.com/docs/guides/auth/sessions).

### 6.4 Locatie, intrekking en gevoelige acties

IP-adressen en fingerprints zijn risicosignalen, geen zelfstandig identiteitsbewijs. Een IP-adres bewijst geen fysieke locatie.

Een normale wisseling tussen wifi, 5G of dynamische IP-adressen veroorzaakt op zichzelf geen herhaalde prompt. Accepteer forwarded-IP-headers uitsluitend van vertrouwde infrastructuur.

Gebruikers kunnen vertrouwde apparaten bekijken en intrekken. Expliciete uitlog, accountblokkering, MFA-reset, compromittering en beveiligingsherstel beëindigen het toepasselijke vertrouwen.

Voor wijzigingen aan MFA, rollen of andere kritieke beveiligingsinstellingen kan verse TOTP-verificatie verplicht zijn.

Het cookie beveiligt uitsluitend de trusted-device-registratie. Het herschrijft niet automatisch de bestaande SSR- of browserauthopslag. Controleer bescherming tegen CSRF, sessiefixatie en ongeautoriseerde device-registratie.

## 7. Cache Invalidation Strategy — Consistente State

Iedere succesvolle backoffice-mutatie activeert **na bevestigde databasecommit** een gerichte synchronisatie van alle betrokken caches en schermen.

De mutatie retourneert waar mogelijk de canonieke opgeslagen waarde. De interface verwerkt deze direct en revalideert relevante lijsten, details en afgeleide totalen.

### 7.1 Cachetechnologie correct gebruiken

| Technologie | Mechanisme |
|---|---|
| TanStack Query | `setQueryData()` en/of `invalidateQueries()` |
| SWR | `mutate()` / `useSWRMutation()` |
| Next.js Server Actions | `updateTag()` voor directe read-your-own-writes |
| Next.js Route Handlers/webhooks | Passende `revalidateTag()` / `revalidatePath()` |
| Ongecachete reads | Bevestigde state verwerken en gericht opnieuw ophalen |

SWR gebruikt geen `queryClient.invalidateQueries()`.

Next.js-tags moeten daadwerkelijk aan de betrokken gecachete reads zijn gekoppeld. `router.refresh()` alleen vervangt geen invalidatie van de serverdatacache.

Voorbeeld na een succesvolle Server Action-mutatie:

```ts
// Binnen een Server Action:
// autorisatie en databasecommit zijn al succesvol afgerond.
updateTag(`tenant:${tenantId}:customers`);
updateTag(`tenant:${tenantId}:customer:${customerId}`);
```

`updateTag()` is specifiek bedoeld voor Server Actions en directe zichtbaarheid van eigen wijzigingen. Stale-while-revalidate is niet geschikt wanneer de eerstvolgende read gegarandeerd de nieuwe waarde moet tonen. Zie [Next.js updateTag](https://nextjs.org/docs/app/api-reference/functions/updateTag).

TanStack Query-voorbeeld:

```ts
// tenantId komt uit geverifieerde applicatiecontext.
await Promise.all([
  queryClient.invalidateQueries({
    queryKey: ["tenant", tenantId, "customers"],
  }),
  queryClient.invalidateQueries({
    queryKey: ["tenant", tenantId, "customer", customerId],
  }),
]);
```

Wacht bij actieve schermen op relevante verversing wanneer dit nodig is voor een consistente afronding. Zie [TanStack Query — Invalidations from Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations).

### 7.2 Race conditions en herstel

- Querykeys en tags bevatten de juiste tenant- en eventueel gebruikersscope.
- Annuleer of negeer achterhaalde reads die nieuwe state kunnen overschrijven.
- Gebruik waar nodig recordversies om concurrente wijzigingen te herkennen.
- Een lopende edit wordt niet ongemerkt overschreven door achtergrondverversing.
- Vermijd invalidatielussen, volledige cache-resets en ongecontroleerde polling.
- Verwijderde records verdwijnen uit relevante detail- en lijstcaches.
- Mutaties vanuit jobs, webhooks en andere apparaten krijgen eveneens een synchronisatiestrategie.
- Na uitlog of tenantwissel wordt toepasselijke persoonlijke clientstate gewist.

Als de write slaagt maar verversing mislukt, meld dat de wijziging is opgeslagen en de weergave opnieuw moet worden geladen. Herhaal de write niet automatisch.

Gebruik voor kritieke asynchrone invalidatie een duurzaam herstelmechanisme, bijvoorbeeld een outbox met retries.

Cache-invalidatie voorkomt verouderde state, maar lost niet zelfstandig alle freezes op. Onderzoek ook renderlussen, geblokkeerde requests en vastgelopen pending-statussen.

## 8. PostgreSQL op de VPS

Optimaliseer queryvormen en indexen voordat servercapaciteit wordt verhoogd.

Indexen sluiten aan op filters, joins, RLS-predicaten en sortering. Voor een tenanttijdlijn kan `(tenant_id, created_at, id)` passend zijn; controleer bestaande indexen en het queryplan eerst.

Gebruik representatieve datasets en queryplannen. `EXPLAIN ANALYZE` voert de query uit; behandel writes en zware productiequeries dienovereenkomstig.

Gebruik parameterbinding, korte transacties en passende statement- en locktimeouts. Doe geen externe API-aanroepen binnen open database-transacties.

Autovacuum, statistieken, opslagruimte, backups en onderhoud blijven actief.

Grote exports, transcripties en mediaverwerking draaien buiten het interactieve requestpad, met begrensde concurrency.

## 9. Next.js, Frontend en Caching

Gebruik Server Components voor serverdata en beperk Client Components tot benodigde interactie.

Start onafhankelijke dataverzoeken zonder onnodige waterfalls. Laad zware editors, grafieken en videomodules wanneer nodig.

Gebruik passende afbeeldingsafmetingen, responsive varianten en efficiënte formaten. Reserveer ruimte om layoutverschuivingen te voorkomen.

Cache openbare, stabiele content waar dit helpt. Cache gebruikers- of tenantdata uitsluitend met expliciete isolatie, toegangscontrole en invalidatie.

Geen persoonlijke portaalresponses in gedeelde publieke caches. Deel geen authclients met gebruikerssessies tussen gebruikers.

Controleer caching-API’s tegen de geïnstalleerde Next.js-versie. Pas hoofdstuk 7 toe op elke wijziging die gecachete gegevens beïnvloedt.

## 10. Optimistic UI

Gebruik Optimistic UI voor omkeerbare acties met laag risico, zoals voorkeuren of conceptmarkeringen.

Betalingen, walletmutaties, credits, rechtenwijzigingen, definitieve boekingen en verwijderingen tonen direct voortgang, maar bevestigen succes pas na serverbevestiging.

Verplicht:

- Herkenbare pending-status.
- Bescherming tegen dubbele acties.
- Herstel bij fouten en een bruikbare foutmelding.
- Reconciliatie met de daadwerkelijke serverwaarde.
- Servervalidatie van gebruiker, tenant, invoer en versieconflicten.

React-voorbeeld:

```tsx
"use client";

import {
  useOptimistic,
  useState,
  useTransition,
} from "react";

type Result =
  | { ok: true; enabled: boolean }
  | { ok: false; message: string };

export function PreferenceToggle({
  initialEnabled,
  saveAction,
}: {
  initialEnabled: boolean;
  saveAction: (enabled: boolean) => Promise<Result>;
}) {
  const [confirmed, setConfirmed] = useState(initialEnabled);
  const [optimistic, setOptimistic] = useOptimistic(confirmed);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    if (pending) return;

    const next = !optimistic;
    setError(null);

    startTransition(async () => {
      setOptimistic(next);

      try {
        const result = await saveAction(next);

        if (!result.ok) {
          setError(result.message);
          return;
        }

        startTransition(() => {
          setConfirmed(result.enabled);
        });
      } catch {
        setError("Opslaan mislukt. Probeer opnieuw.");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={optimistic}
        aria-busy={pending}
      >
        {pending
          ? "Opslaan..."
          : optimistic
            ? "Ingeschakeld"
            : "Uitgeschakeld"}
      </button>
      <p role="status">{error}</p>
    </div>
  );
}
```

`saveAction` gebruikt een geautoriseerde Server Action of beveiligd endpoint. Deze retourneert de opgeslagen waarde en synchroniseert relevante caches.

Bij mislukking blijft `confirmed` behouden en vervalt de tijdelijke optimistische waarde na afloop. Updates vanuit andere tabbladen vereisen aanvullende reconciliatie.

## 11. GPT-6.1 en AI-functionaliteit

### Ontwikkelwerk

GPT-6.1 en andere codeagents moeten:

- Repositoryafspraken, versies en bestaande datastromen lezen.
- De concrete bottleneck meten voordat zij architectuur wijzigen.
- Gerichte wijzigingen uitvoeren met relevante controles.
- Autorisatie, tenantisolatie en correcte werking behouden.
- Geen wildcardqueries, onbeperkte lijsten of requestgebonden pools introduceren.
- Resultaten onderbouwen met vergelijkbare voor- en nametingen.

### AI in applicaties

- Gebruik ondersteunde model- en API-instellingen op basis van kwaliteitsevaluaties.
- Gebruik voor GPT-6.1 Sol bij toolgebruik de ondersteunde Responses API.
- Stem reasoning effort en outputlengte af op de taak.
- Stream wanneer dit eerder bruikbare feedback geeft.
- Gebruik een stabiele promptprefix waar prompt caching passend is.
- Beperk context en toolaanroepen tot benodigde gegevens.
- Voer onafhankelijke tools parallel uit met begrensde concurrency.
- Verwerk lange transcripties en rapporten als achtergrondtaken.
- Meet tijd tot eerste output, totale duur, fouten, kwaliteit en kosten.
- Pas dezelfde tenant- en rollencontrole toe op AI-tools als op gewone endpoints.

Er geldt geen gegarandeerde latency voor GPT-6.1. De interface blijft bruikbaar bij wisselende modelrespons.

## 12. Meten, Verifiëren en Uitzonderingen

Initiële doelen:

| Metriek | Doel |
|---|---:|
| LCP, mobiel, 75e percentiel | ≤ 2,5 seconden |
| INP, 75e percentiel | ≤ 200 milliseconden |
| CLS, 75e percentiel | ≤ 0,1 |
| Gewone lijstpagina | ≤ 50 records |
| Normale API-read, end-to-end p95 | ≤ 800 milliseconden |

Dit zijn interne doelen, geen gemeten resultaten of beschikbaarheidsgaranties. AI-generatie, uploads, exports en mediaverwerking krijgen afzonderlijke budgetten.

Meet netwerkduur, functieduur, queryduur, poolwachttijd, payloadgrootte en fouten onder vergelijkbare omstandigheden.

Verificatie omvat:

- Queryprojecties, limieten en volledige paginering.
- Belastingtests bij poolwijzigingen.
- Optimistic UI bij succes, fout en herstel.
- Toegangsweigering tussen tenants en rollen, ook bij directe API-aanroepen.
- MFA bij eerste toegang, geldig vertrouwen, expiry en intrekking.
- Correcte state na writes, deletes, tenantwissels en uitlog.
- Geen vertraagde response die nieuwere state overschrijft.

Uitzonderingen zijn expliciet, gemotiveerd en begrensd.

Universele uitrol van dit document wijzigt geen secrets, regio’s, databaseconfiguratie, sessiebeleid of applicatiegedrag automatisch.
