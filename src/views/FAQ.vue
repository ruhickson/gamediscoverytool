<template>
  <div class="faq">
    <div class="card">
      <div class="card-header">
        <h5><i class="fas fa-question"></i> Frequently Asked Questions</h5>
      </div>
      <div class="card-body info-section">
        <h4>Q: How does the game discovery work?</h4>
        <p>A: The tool searches through a comprehensive database of Steam games, filtering by your selected tags, review scores, release dates, and other criteria to find games that match your preferences.</p>
        
        <h4>Q: What's the difference between Review Score and Steam Review Score?</h4>
        <p>A: Review Score shows Steam's overall rating (e.g., 'Very Positive'), while Steam Review Score shows the exact percentage of positive reviews with a visual bar.</p>
        
        <h4>Q: Can I exclude games with certain tags?</h4>
        <p>A: Yes! Use the 'Exclude Tags' filter to remove games that have any of the selected tags from your results.</p>
        
        <h4>Q: Why are some games missing from results?</h4>
        <p>A: Games might be filtered out due to your criteria (review scores, release dates, excluded tags) or they might be coming soon games, which are automatically excluded.</p>
        
        <h4>Q: How often is the game data updated?</h4>
        <p>A: The database is regularly updated with the latest game information, reviews, and metadata from Steam.</p>
        
        <h4>Q: Can I share games I find?</h4>
        <p>A: Yes! Click the 🔗 share button next to any game to copy its information for sharing.</p>
        
        <h4>Q: What if my search takes too long?</h4>
        <p>A: Complex searches may timeout. Try simplifying your criteria by selecting fewer tags or adjusting your date range.</p>
        
        <h4>Q: Are there any limitations?</h4>
        <p>A: The tool focuses on Steam games and may not include every single game. Some very new or very old games might not appear in results.</p>
        
        <h4>Q: The number of reviews in the app is different than on Steam</h4>
        <p>A: Steam updates its reviews instantly while the app updates much slower, probably once a month. They'll never be fully in sync, but they'll always be in the same ballpark.</p>
        
        <h4>Q: A game came out five minutes ago and I can't find it in the app</h4>
        <p>A: The app refreshes once a day. If it's not there today, your game will be there tomorrow.</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FAQ'
}
</script>
