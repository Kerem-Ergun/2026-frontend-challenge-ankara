# Quick Start Guide - Investigation Dashboard

## 🚀 Getting Started

### 1. Install & Run
```bash
cd /Users/keremergun/Desktop/2026-frontend-challenge-ankara
npm start
```

### 2. Configure API Keys
The system uses 3 API keys for rate limiting. If you get "API-Limit exceeded":

Edit `.env` file:
```
REACT_APP_JOTFORM_API_KEY_1=your_key_here
REACT_APP_JOTFORM_API_KEY_2=your_key_here
REACT_APP_JOTFORM_API_KEY_3=your_key_here
```

Get new API keys from: https://jotform.com (Account > API section)

### 3. Open Browser
Navigate to: http://localhost:3000

## 📊 Using the Dashboard

### Tab 1: Raw Submissions
View raw data from all Jotform submissions:
- 📍 Checkins: Where people checked in
- 💬 Messages: Communication between people
- 👁️ Sightings: Where people were spotted
- 📝 Personal Notes: Notes from users
- 🕵️ Anonymous Tips: Anonymous reports

**How to use:**
- Click on a submission to expand details
- See all form responses in a card layout
- Submission count shows at top of each section

### Tab 2: Intelligence Analysis
Advanced analysis with data normalization and record linking:

#### Dashboard Statistics
```
👥 People: Total unique people identified (with record linking)
📍 Locations: Geographic locations mentioned
📅 Timeline Events: Total events across all sources
🔗 Connections: Known relationships between people
```

#### People of Interest
- **Browse**: Scroll through identified people
- **Filter**: Click a person card to select them
- **Stats**: See message/sighting/location counts at a glance
- **Mini-view**: Quick preview of connected people

#### Person Profile (when selected)
Shows detailed information:

**📊 Summary**
- First time seen (earliest activity)
- Last time seen (most recent activity)
- Aliases (name variations the system linked)

**👁️ Chain of Sightings**
- Chronological list of where the person was spotted
- Use the filter to search by location (e.g., "Kızılay")
- See who they were spotted with
- Descriptions of the sighting

**📍 Check-ins**
- All self-reported locations
- Dates and times

**💬 Messages**
- Messages sent by this person
- Recipient and content visible

**🔗 Connected People**
- Click any name to jump to their profile
- Navigate through the network

## 🔍 Advanced Features

### Location-Based Investigation
```
1. Select a person
2. In Chain of Sightings, filter by location
3. See all sightings at that location and time
4. Time window: ~60 minutes
```

**Use Case**: Track Podo's movement at "Kızılay"
- Filter by "Kızılay"
- See exact times and who was with Podo
- Identify patterns

### Following Connections
```
1. Click a person
2. See Connected People at bottom
3. Click any connected person
4. Jump to their profile and see their chain
```

**Use Case**: Who did Ahmet interact with?
- See all people in Ahmet's network
- Trace communication chains
- Identify clusters

### Timeline Reconstruction
```
Raw Submissions tab:
- Chronological order of ALL events
- Sorted oldest to newest
- Cross-reference people across forms
```

## 📥 Data Export

In Intelligence Analysis tab → Click **"📥 Export Data to Console"**

Opens browser DevTools with full investigation data structure:
```javascript
{
  people: [
    {
      name: "Ahmet",
      aliases: ["Ahmet", "AHMET", "ahmet ergun"],
      locationsCount: 5,
      messagesCount: 3,
      sightingsAsSubject: 7,
      connectedPeople: ["Podo", "Fatih", "Ayşe"],
      firstSeen: Date,
      lastSeen: Date
    },
    // ... more people
  ],
  timelineCount: 45,
  locationCount: 8,
  lastUpdated: Date
}
```

Open DevTools (F12 or Right-click → Inspect) → Console tab

## 🎯 Investigation Workflow

### Scenario: Track Podo's Activities

**Step 1: Get Overview**
- Go to Intelligence Analysis
- See "People" count and "Locations" count
- Identify Podo in the list

**Step 2: View Profile**
- Click on "Podo" card
- See summary (when first/last seen)

**Step 3: Map Movements**
- Look at "Chain of Sightings"
- See locations in chronological order
- Note who Podo was with (spottedWith)

**Step 4: Location Focus**
- Filter sightings by location: "Kızılay"
- See all times Podo was at Kızılay
- See who else was there

**Step 5: Network Analysis**
- Look at "Connected People"
- Click person names to see their profiles
- Understand Podo's social network

**Step 6: Export Data**
- Click "Export Data to Console"
- Copy data to spreadsheet/document
- Create report

## 💡 Record Linking Explained

The system *automatically merges* people with same name variations:

```
Different spellings/formats → Single Profile:
- "Ahmet"
- "AHMET"
- "ahmet"
- "Ahmet Ergun" (if 85%+ match)
→ All become: ahmet ergun profile
```

**Why it's smart:**
- Handles typing errors
- Works with case differences
- Recognizes partial names
- Uses Levenshtein distance algorithm

**You can adjust:**
- Stricter matching (fewer merges)
- Looser matching (more merges)
- See DATA_NORMALIZATION_GUIDE.md

## ⚠️ Troubleshooting

### Problem: No data showing
**Solution:**
1. Check API keys in `.env` file
2. Verify keys are valid on jotform.com
3. Check browser console (F12) for errors
4. Refresh page

### Problem: "API-Limit exceeded"
**Solution:**
1. Edit `.env` file with new API keys
2. Save file
3. Restart with: `npm start`
4. Wait a few minutes for rate limit reset

### Problem: Can't find a person
**Solution:**
1. Check spelling
2. The name might have been linked to another entry
3. Use browser search (Ctrl+F) in People list
4. Check Raw Submissions tab for original name

### Problem: Dashboard loading slowly
**Solution:**
1. Reduce data: Limit form submissions
2. Close other browser tabs
3. Check internet connection
4. Try refreshing page

## 📱 Tips & Tricks

- **Keyboard Navigation**: Use Tab to jump between people
- **Search Console**: Open DevTools, export data, analyze with copy/paste
- **Location Names**: Filter accepts partial matches ("Kız" matches "Kızılay")
- **Time Stamps**: Hover for precise time, click to copy
- **Mobile**: Works on mobile but tabs are vertical for space
- **Print Dashboard**: Right-click → Print screen for PDF reports

## 🔗 Resources

- **Full Documentation**: See `DATA_NORMALIZATION_GUIDE.md`
- **Technical Summary**: See `IMPLEMENTATION_SUMMARY.md`
- **Jotform API Docs**: https://api.jotform.com/docs
- **TypeScript Docs**: https://www.typescriptlang.org/docs

## 📞 Support

For errors or issues:
1. Check browser console (F12 → Console)
2. Look for red error messages
3. Note the error text
4. Check DATA_NORMALIZATION_GUIDE.md for solutions
5. Review TypeScript types for data structure

---

**Ready to analyze?** Click "Intelligence Analysis" tab and start investigating! 🔍
