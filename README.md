# Game Discovery Tool - Vue.js Version

A Vue.js conversion of the Game Discovery Tool that helps users find Steam games based on their preferences.

## Features

- **Advanced Game Filtering**: Filter by tags, review scores, release dates, and review counts
- **Multiple Sorting Options**: Sort by release date, review score, popularity, or game name
- **Tag Exclusion**: Exclude games with specific tags you don't want
- **Visual Steam Scores**: Color-coded percentage bars for Steam review scores
- **Game Sharing**: Copy game information to clipboard for sharing
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Multiple Pages**: Separate pages for How to Use, FAQ, and About sections

## Technology Stack

- **Vue 3**: Modern reactive framework with Composition API
- **Vue Router**: Client-side routing
- **Bootstrap 5**: Responsive UI components
- **Font Awesome**: Icons
- **Vite**: Fast build tool and development server

## Project Structure

```
vue-app/
├── src/
│   ├── views/           # Page components
│   │   ├── GameFinder.vue
│   │   ├── HowToUse.vue
│   │   ├── FAQ.vue
│   │   └── About.vue
│   ├── router/          # Vue Router configuration
│   │   └── index.js
│   ├── App.vue          # Main app component
│   ├── main.js          # App entry point
│   └── style.css        # Global styles
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration
└── README.md           # This file
```

## Installation & Setup

1. **Navigate to the vue-app directory:**
   ```bash
   cd vue-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Cube.js connection:**
   ```bash
   # Copy the environment template (already contains your credentials)
   cp env.example .env
   
   # The .env file is now ready with your Cube.js credentials:
   # - API URL: https://wooden-rodent.gcp-europe-west3-a.cubecloudapp.dev/cubejs-api/v1
   # - Auth Token: (configured automatically)
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   The app will be available at `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Key Features Implemented

### Game Finder Page
- Multi-select tag filtering
- Tag exclusion functionality
- Review score filtering with "or better" option
- Review count range filtering
- Release date range selection
- Multiple sorting options
- Real-time search with loading states
- Results table with Steam score visualization
- Game sharing functionality

### Information Pages
- **How to Use**: Step-by-step guide for using the tool
- **FAQ**: Common questions and answers about the tool
- **About**: Information about the tool, features, and upcoming YouTube channel

### UI/UX Features
- Steam-themed color scheme
- Responsive sidebar navigation
- Loading states and error handling
- Visual feedback for user actions
- Mobile-friendly design

## Real Data Integration

The Vue app now connects to your actual Cube.js instance and provides the same functionality as the original R Shiny app:

### Features Implemented:
- **Real-time data** from your Cube.js database
- **Tag filtering** with actual Steam game tags
- **Review score filtering** with "or better" logic
- **Date range filtering** for release dates
- **Review count filtering** for popularity
- **Tag exclusion** functionality
- **Multiple sorting options** (9 different ways)
- **Steam score calculation** from positive/negative reviews
- **Error handling** with retry logic and timeout management
- **Loading states** and user feedback

### Cube.js Integration:
- Uses the same query structure as your R Shiny app
- Implements the same filtering and sorting logic
- Handles multi-tag intersection queries
- Supports exclude tag functionality
- Includes proper error handling for timeouts and connection issues

## Customization

### Styling
The app uses CSS custom properties for theming. You can modify the color scheme by updating the variables in `src/style.css`:

```css
:root {
  --steam-blue: #66c0f4;
  --steam-dark-blue: #1b2838;
  --steam-light-blue: #2a475e;
  --steam-text: #c7d5e0;
  --steam-accent: #28a745;
}
```

### Adding New Features
- Add new routes in `src/router/index.js`
- Create new view components in `src/views/`
- Update the sidebar navigation in `src/App.vue`

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT License - feel free to use and modify as needed.
