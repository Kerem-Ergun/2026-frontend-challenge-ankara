# Data Normalization Utility Documentation

## Overview

The Data Normalization utility is a TypeScript-based system designed to aggregate and deduplicate data from multiple Jotform submissions into a unified investigation database. It implements **record linking** to identify the same person across different data sources and creates a comprehensive master investigation object.

## Key Concepts

### 1. **Record Linking**
The system uses fuzzy matching to identify the same person appearing in different forms with different name spellings or formats.

- **Similarity Scoring**: Uses Levenshtein distance algorithm to calculate name similarity (0-1 scale)
- **Threshold**: Defaults to 0.85 (85% similarity)
- **Normalization**: Names are converted to lowercase, extra spaces removed, and special characters filtered

```typescript
// Example: "Ahmet", "AHMET", "ahmet ergun" would be linked as the same person
```

### 2. **Master Person Profile**
Each unique person gets a `PersonProfile` that aggregates:
- **locations**: All check-ins and sightings by location and time
- **messages**: All messages sent by the person
- **sightings**: 
  - `asSubject`: Where the person was spotted
  - `withOthers`: Sightings where they appeared with other people
- **checkins**: Self-reported location check-ins
- **notes**: Personal notes authored by the person
- **tipsAbout**: Anonymous tips mentioning the person
- **connectedPeople**: Other people linked through messages or sightings
- **firstSeen** / **lastSeen**: Timeline range of all activities

### 3. **Chain of Sightings**
Provides a chronological view of where a specific person was detected:

```typescript
interface SightingChain {
  person: string;
  sightings: Array<{
    timestamp: Date;
    location: string;
    spottedWith: string[];
    description?: string;
  }>;
}
```

### 4. **Location-Based Connections**
Identifies people who were at the same location within a configurable time window.

```typescript
// Example: Find everyone who was at Kızılay within 60 minutes of each other
findLocationBasedConnections(data, 60)
```

## Core Functions

### `normalizeFormData()`
Main function that processes all form submissions and creates the investigation object.

```typescript
const investigationData = normalizeFormData(
  checkinsData,
  messagesData,
  sightingsData,
  personalNotesData,
  anonymousTipsData
);
```

**Returns**:
```typescript
interface InvestigationData {
  people: Map<string, PersonProfile>;
  timeline: Array<{timestamp, person, event, location}>;
  locationCluster: Map<string, Set<string>>;
  connections: Map<string, Set<string>>;
  lastUpdated: Date;
}
```

### `findOrCreatePerson()`
Uses fuzzy matching to find an existing person or create a new one with record linking.

```typescript
const personProfile = findOrCreatePerson(peopleMap, "Ahmet", 0.85);
```

### `getChainOfSightings()`
Returns chronological sightings for a person, optionally filtered by location.

```typescript
const chain = getChainOfSightings(personProfile, "Kızılay");
// Returns sightings at Kızılay in chronological order
```

### `findLocationBasedConnections()`
Finds people who were at the same location within a time window.

```typescript
const connections = findLocationBasedConnections(investigationData, 60);
// Returns people who were at same locations within 60 minutes
```

### `getSimilarityScore()`
Calculates name similarity using Levenshtein distance.

```typescript
const score = getSimilarityScore("Ahmet", "Ahmed"); // ~0.80
```

### `normalizeName()`
Converts a name to a normalized format (lowercase, trimmed, no special chars).

```typescript
const normalized = normalizeName("AHMET Ergun"); // "ahmet ergun"
```

## Data Structures

### PersonProfile
```typescript
interface PersonProfile {
  name: string;                           // Original name
  normalizedName: string;                 // Lowercase for matching
  aliases: Set<string>;                   // All variations of the name
  locations: GeoLocation[];               // All locations with timestamps
  messages: Message[];                    // Messages sent
  sightings: {
    asSubject: Sighting[];               // Where they were spotted
    withOthers: Sighting[];              // Sightings with other people
  };
  checkins: CheckIn[];                    // Check-in records
  notes: PersonalNote[];                  // Notes they created
  tipsAbout: AnonymousTip[];             // Anonymous tips mentioning them
  lastSeen?: Date;
  firstSeen?: Date;
  connectedPeople: Set<string>;           // Related people
}
```

## Usage Example

### React Component Integration

```typescript
import { normalizeFormData, getChainOfSightings } from './services/dataNormalization';
import InvestigationDashboard from './components/InvestigationDashboard';

// In your component:
const investigationData = normalizeFormData(
  checkins,
  messages,
  sightings,
  personalNotes,
  anonymousTips
);

// Get chain of sightings for a person
const personProfile = investigationData.people.get('ahmet');
const chain = getChainOfSightings(personProfile, 'Kızılay');

// Display in dashboard
<InvestigationDashboard 
  checkins={checkins}
  messages={messages}
  sightings={sightings}
  personalNotes={personalNotes}
  anonymousTips={anonymousTips}
/>
```

### Finding Connections at a Location

```typescript
// Find when "Podo" and "Ahmet" were at the same location
const data = normalizeFormData(...);
const podo = data.people.get('podo');

// Get locations where Podo was spotted
const podoLocations = [...new Set(podo?.locations.map(l => l.location))];

// Find who else was at those locations
podoLocations.forEach(location => {
  const peopleAtLocation = data.locationCluster.get(location);
  console.log(`At ${location}:`, [...peopleAtLocation]);
});
```

## Record Linking Examples

The system automatically links these as the same person:

```
✓ "Ahmet" + "AHMET" → Matched (100%)
✓ "Ahmet" + "Ahmed" → Matched (80%)
✓ "Ayşe Yılmaz" + "ayse yilmaz" → Matched (100%)
✓ "Kerem Ergun" + "kerem" → Not matched (too different)
```

You can adjust the threshold:

```typescript
// Stricter matching (95%)
findOrCreatePerson(peopleMap, "Ahmet", 0.95);

// Looser matching (75%)
findOrCreatePerson(peopleMap, "Ahmet", 0.75);
```

## Export and Analysis

### Export Investigation Data

```typescript
import { exportInvestigationData } from './services/dataNormalization';

const summary = exportInvestigationData(investigationData);
console.log(summary);
/* Output:
{
  people: [
    {
      name: "Ahmet",
      aliases: ["Ahmet", "AHMET"],
      locationsCount: 5,
      messagesCount: 3,
      sightingsAsSubject: 7,
      checkinsCount: 2,
      connectedPeople: ["Podo", "Ayşe"],
      firstSeen: Date,
      lastSeen: Date
    }
  ],
  timelineCount: 45,
  locationCount: 8,
  lastUpdated: Date
}
*/
```

## Performance Considerations

- **Fuzzy Matching**: O(n*m) where n,m are name lengths. Capped at reasonable limits.
- **Timeline Building**: O(events)
- **Location Clustering**: O(events)
- **Memory**: Efficient with Maps and Sets

## Advanced Use Cases

### 1. Find People at Specific Location and Time

```typescript
function getPeopleAtLocationTime(
  data: InvestigationData,
  location: string,
  date: Date,
  timeWindowMinutes: number = 60
) {
  const people: string[] = [];
  
  data.people.forEach((profile) => {
    const locAtTime = profile.locations.find(loc => 
      loc.location.toLowerCase().includes(location.toLowerCase()) &&
      Math.abs(loc.timestamp.getTime() - date.getTime()) < timeWindowMinutes * 60 * 1000
    );
    if (locAtTime) people.push(profile.name);
  });
  
  return people;
}
```

### 2. Identify Suspicious Contacts

```typescript
function findSuspiciousContacts(
  data: InvestigationData,
  targetPerson: string,
  connectionDepth: number = 2
) {
  const target = data.people.get(targetPerson);
  const contacts = new Set<string>();
  
  // Breadth-first search of connections
  const queue = [targetPerson];
  const visited = new Set<string>();
  
  // ... implementation ...
  
  return Array.from(contacts);
}
```

### 3. Timeline Analysis

```typescript
// Get all events for a person in date range
function getPersonTimeline(
  person: PersonProfile,
  startDate: Date,
  endDate: Date
) {
  const events: any[] = [];
  
  // Collect all events
  person.locations.forEach(loc => {
    if (loc.timestamp >= startDate && loc.timestamp <= endDate) {
      events.push({ type: 'location', ...loc });
    }
  });
  
  person.messages.forEach(msg => {
    if (msg.timestamp >= startDate && msg.timestamp <= endDate) {
      events.push({ type: 'message', ...msg });
    }
  });
  
  // Sort and return
  return events.sort((a, b) => a.timestamp - b.timestamp);
}
```

## Type Definitions

All types are exported from `dataNormalization.ts`:

```typescript
export interface PersonProfile { }
export interface InvestigationData { }
export interface SightingChain { }
export interface PersonalNote { }
export interface Message { }
export interface Sighting { }
export interface CheckIn { }
export interface AnonymousTip { }
export interface GeoLocation { }
```

## Error Handling

The system handles:
- Missing or malformed data
- Empty arrays
- Null/undefined values
- Invalid timestamps
- Duplicate IDs (uses latest)

All errors are logged to console for debugging.
