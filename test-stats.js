// Test script to verify stats endpoint
const axios = require('axios');

async function testStats() {
  try {
    console.log('Testing Stats GraphQL endpoint...\n');
    
    const response = await axios.post('http://localhost:4000/graphql', {
      query: `
        query {
          getStats {
            data {
              currentSnapshot {
                downloaded {
                  movies
                  series
                  episodes
                }
                activeDownloads
                queuedDownloads
                failedDownloads
                diskUsage
                totalBandwidth
              }
              hourlyStats {
                hour
                downloaded {
                  movies
                  series
                }
              }
            }
            tokens
          }
        }
      `
    }, {
      headers: {
        'Content-Type': 'application/json',
        // Add auth token if needed
      }
    });

    if (response.data.errors) {
      console.log('GraphQL Errors:', response.data.errors);
    } else {
      console.log('✅ Stats endpoint is working!\n');
      console.log('Current Snapshot:');
      const snapshot = response.data.data.getStats.data.currentSnapshot;
      console.log(`  - Movies Downloaded: ${snapshot.downloaded.movies}`);
      console.log(`  - Series Downloaded: ${snapshot.downloaded.series}`);
      console.log(`  - Episodes Downloaded: ${snapshot.downloaded.episodes}`);
      console.log(`  - Active Downloads: ${snapshot.activeDownloads}`);
      console.log(`  - Queued Downloads: ${snapshot.queuedDownloads}`);
      console.log(`  - Failed Downloads: ${snapshot.failedDownloads}`);
      console.log(`  - Disk Usage: ${(snapshot.diskUsage / (1024*1024*1024)).toFixed(2)} GB`);
      console.log(`  - Total Bandwidth: ${(snapshot.totalBandwidth / (1024*1024)).toFixed(2)} MB/s`);
      
      const hourlyStats = response.data.data.getStats.data.hourlyStats;
      console.log(`\nHourly Stats Records: ${hourlyStats.length}`);
    }
  } catch (error) {
    console.error('❌ Error testing stats endpoint:', error.message);
    if (error.response) {
      console.log('Response:', error.response.data);
    }
  }
}

testStats();