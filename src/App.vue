<template>
  <div id="app">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
      <div class="container-fluid">
        <a class="navbar-brand" href="#">
          <i class="fas fa-gamepad me-2"></i>
          Game Discovery Tool
        </a>
      </div>
    </nav>
    
    <div class="container-fluid">
      <div class="row">
        <!-- Sidebar -->
        <nav class="col-md-3 col-lg-2 d-md-block sidebar collapse">
          <div class="position-sticky pt-3">
            <ul class="nav flex-column">
              <li class="nav-item">
                <router-link 
                  to="/" 
                  class="nav-link"
                  :class="{ active: $route.name === 'GameFinder' }"
                >
                  <i class="fas fa-search"></i>
                  Find a Game for Me
                </router-link>
              </li>
              <li class="nav-item">
                <router-link 
                  to="/how-to-use" 
                  class="nav-link"
                  :class="{ active: $route.name === 'HowToUse' }"
                >
                  <i class="fas fa-question-circle"></i>
                  How to Use
                </router-link>
              </li>
              <li class="nav-item">
                <router-link 
                  to="/faq" 
                  class="nav-link"
                  :class="{ active: $route.name === 'FAQ' }"
                >
                  <i class="fas fa-question"></i>
                  F.A.Q.
                </router-link>
              </li>
              <li class="nav-item">
                <router-link 
                  to="/about" 
                  class="nav-link"
                  :class="{ active: $route.name === 'About' }"
                >
                  <i class="fas fa-info-circle"></i>
                  About
                </router-link>
              </li>
            </ul>
          </div>
        </nav>

        <!-- Main content -->
        <main class="col-md-9 ms-sm-auto col-lg-10 px-md-4 main-content">
          <router-view />
        </main>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>
