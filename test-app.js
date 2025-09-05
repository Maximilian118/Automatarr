// Quick test to verify everything is working
const axios = require('axios');

console.log('🚀 Testing Automatarr Application...\n');

// Test 1: Frontend availability
console.log('1. Testing Frontend (http://localhost:8090)...');
axios.get('http://localhost:8090')
  .then(() => console.log('   ✅ Frontend is running successfully!'))
  .catch(err => console.log('   ❌ Frontend error:', err.message));

// Test 2: Backend GraphQL endpoint
console.log('2. Testing Backend GraphQL (http://localhost:8091/graphql)...');
const testQuery = {
  query: `
    query {
      getStats {
        data {
          _id
          currentSnapshot {
            timestamp
            downloaded {
              movies
              series
              episodes
            }
            diskUsage
            totalBandwidth
          }
          created_at
          updated_at
        }
        tokens
      }
    }
  `
};

setTimeout(() => {
  axios.post('http://localhost:8091/graphql', testQuery, {
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => {
    if (response.data.errors) {
      console.log('   ⚠️  GraphQL errors (expected for unauthorized access):', response.data.errors[0].message);
    } else {
      console.log('   ✅ GraphQL is working! Stats data received.');
      console.log('   📊 Current stats:', {
        movies: response.data.data.getStats.data.currentSnapshot.downloaded.movies,
        series: response.data.data.getStats.data.currentSnapshot.downloaded.series,
        episodes: response.data.data.getStats.data.currentSnapshot.downloaded.episodes
      });
    }
  })
  .catch(err => console.log('   ❌ Backend error:', err.message));
}, 1000);

console.log('\n🌐 Application URLs:');
console.log('   Frontend: http://localhost:8090');
console.log('   Backend GraphQL: http://localhost:8091/graphql');
console.log('   Stats Page: http://localhost:8090/stats');
console.log('\n📝 Note: You may need to create a user account first to access the stats page.');