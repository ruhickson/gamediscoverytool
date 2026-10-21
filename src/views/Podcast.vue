<template>
  <div class="podcast">
    <div class="card">
      <div class="card-header">
        <h5><i class="fas fa-podcast"></i> Podcast</h5>
      </div>
      <div class="card-body info-section">
        <p>The podcast is on the way. Until then, the weekly newsletter is where the picks land.</p>
        <router-link to="/newsletter" class="btn btn-primary">Newsletter</router-link>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Podcast'
}
</script>
