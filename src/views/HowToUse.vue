<template>
  <div class="how-to-use">
    <div class="card">
      <div class="card-header">
        <h5><i class="fas fa-question-circle"></i> How to Use This Tool</h5>
      </div>
      <div class="card-body info-section">
        <h4>Finding Games Made Easy</h4>
        <p>This tool helps you discover games that match your preferences. Here's how to use it effectively:</p>
        
        <h5>Step 1: Choose Your Tags</h5>
        <ul>
          <li>Select one or more tags that describe the type of games you want</li>
          <li>Tags are ordered by popularity - the most common tags appear first</li>
          <li>You can select multiple tags to narrow down your search</li>
          <li>Examples: 'Action', 'RPG', 'Multiplayer', 'Indie', 'Horror'</li>
        </ul>
        
        <h5>Step 2: Set Review Criteria</h5>
        <ul>
          <li>Choose a minimum review score (e.g., 'Very Positive' or better)</li>
          <li>Check 'or better' to include games with higher scores</li>
          <li>Set minimum and maximum review counts to filter by popularity</li>
        </ul>
        
        <h5>Step 3: Set Release Date Range</h5>
        <ul>
          <li>Choose when you want games to have been released</li>
          <li>Release Date Range has default ranges in the Quick drop down</li>
          <li>Custom mode allows you to set your own date range</li>
          <li>Select "Beginning of Time" to see all games (takes longer)</li>
        </ul>
        
        <h5>Step 4: Choose How to Sort Results</h5>
        <ul>
          <li>Sort by release date to see newest (DESC) or oldest (ASC) games first</li>
          <li>Sort by review score to see best (DESC) or worst (ASC) reviewed games</li>
          <li>Sort by total reviews to see most (DESC) or least (ASC) popular games</li>
          <li>Sort by game name for alphabetical browsing</li>
        </ul>
        
        <h5>Step 5: Search and Explore</h5>
        <ul>
          <li>Click 'Find Games' to run your search</li>
          <li>Results show all games matching your criteria</li>
          <li>Click on game names to open them in Steam</li>
          <li>Use 'Reset Filters' to start over with a new search</li>
        </ul>
        
        <h5>Optional: Search and Explore</h5>
        <ul>
          <li>There is a tag for games with adult content that is turned off by default. You can turn it on if you want to see them.</li>
          <li>You can filter games by how long it takes to play them, if they have a valid result on How Long to Beat</li>
          <li>There is a limit of 100 results by default to speed up loading times. You can remove the limit if you want to see more results.</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HowToUse'
}
</script>
