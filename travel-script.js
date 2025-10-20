// 全局变量
let map;
let AMap;
let apiKey = null;
let currentRoutes = [];
let waypoints = [];

// 本地存储键名
const API_KEY_STORAGE = 'travel_planner_api_key';
const SAVED_PLANS_STORAGE = 'travel_planner_saved_plans';

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    bindEvents();
});

// 应用初始化
function initApp() {
    const storedKey = localStorage.getItem(API_KEY_STORAGE);

    if (storedKey && validateApiKey(storedKey)) {
        apiKey = storedKey;
        loadAmapAPI(apiKey)
            .then(() => {
                initMap();
                hideApiSetup();
                showNotification('✅ 欢迎回来！地图已准备就绪', 'success');
            })
            .catch(error => {
                console.error('地图加载失败:', error);
                showNotification('❌ 地图加载失败，请重新设置API密钥', 'error');
                showApiSetup();
            });
    } else {
        showApiSetup();
    }
}

// 绑定事件监听器
function bindEvents() {
    // API设置相关
    document.getElementById('toggle-api-visibility').addEventListener('click', toggleApiVisibility);
    document.getElementById('save-api-key').addEventListener('click', saveApiKey);
    document.getElementById('get-api-help').addEventListener('click', toggleApiHelp);
    document.getElementById('api-key-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') saveApiKey();
    });

    // 定位功能
    document.getElementById('use-current-location').addEventListener('click', getCurrentLocation);
    document.getElementById('use-ip-location').addEventListener('click', getIPLocation);

    // 搜索功能
    document.getElementById('search-origin').addEventListener('click', () => searchLocation('origin'));
    document.getElementById('search-destination').addEventListener('click', () => searchLocation('destination'));

    // 回车键搜索
    document.getElementById('origin').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchLocation('origin');
    });
    document.getElementById('destination').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchLocation('destination');
    });

    // 途经点管理
    document.getElementById('add-waypoint').addEventListener('click', addWaypoint);

    // 路线规划
    document.getElementById('plan-route').addEventListener('click', planRoute);
    
    // 快捷操作
    document.getElementById('clear-all').addEventListener('click', clearAll);
    document.getElementById('reverse-route').addEventListener('click', reverseRoute);
    document.getElementById('change-api').addEventListener('click', changeApiKey);

    // 地图控制
    document.getElementById('center-map').addEventListener('click', centerMap);
    document.getElementById('satellite-view').addEventListener('click', toggleSatelliteView);
    document.getElementById('traffic-view').addEventListener('click', toggleTrafficView);

    // 保存和导出
    document.getElementById('save-plan').addEventListener('click', savePlan);
    document.getElementById('export-plan').addEventListener('click', exportPlan);

    // 排序选择
    document.getElementById('sort-by').addEventListener('change', sortResults);
}

// API密钥管理
function validateApiKey(key) {
    return key && key.trim().length >= 20;
}

function toggleApiVisibility() {
    const input = document.getElementById('api-key-input');
    const btn = document.getElementById('toggle-api-visibility');
    
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

function saveApiKey() {
    const key = document.getElementById('api-key-input').value.trim();
    const btn = document.getElementById('save-api-key');
    
    if (!validateApiKey(key)) {
        alert('请输入有效的API密钥（至少20个字符）');
        return;
    }

    btn.textContent = '🔄 验证中...';
    btn.disabled = true;

    loadAmapAPI(key)
        .then(() => {
            localStorage.setItem(API_KEY_STORAGE, key);
            apiKey = key;
            initMap();
            hideApiSetup();
            
            // 清空输入
            document.getElementById('api-key-input').value = '';
            document.getElementById('api-key-input').type = 'password';
            document.getElementById('toggle-api-visibility').textContent = '👁️';
            
            showNotification('✅ API密钥设置成功！开始你的旅程吧！', 'success');
        })
        .catch(error => {
            console.error('API验证失败:', error);
            alert('❌ API密钥验证失败，请检查密钥是否正确\n\n错误详情: ' + error.message);
        })
        .finally(() => {
            btn.textContent = '💾 开始我的旅程';
            btn.disabled = false;
        });
}

function toggleApiHelp() {
    const help = document.getElementById('api-help');
    const btn = document.getElementById('get-api-help');
    
    if (help.style.display === 'none') {
        help.style.display = 'block';
        btn.textContent = '❌ 隐藏帮助';
    } else {
        help.style.display = 'none';
        btn.textContent = '❓ 如何获取密钥';
    }
}

function showApiSetup() {
    document.getElementById('api-setup').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
}

function hideApiSetup() {
    document.getElementById('api-setup').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
}

function changeApiKey() {
    if (confirm('确定要更换API密钥吗？这将清除当前设置。')) {
        localStorage.removeItem(API_KEY_STORAGE);
        showApiSetup();
    }
}

// 高德地图API加载
function loadAmapAPI(key) {
    return new Promise((resolve, reject) => {
        console.log('开始加载API，密钥:', key.substring(0, 8) + '...');

        // 移除旧脚本 - 使用和快速测试相同的方法
        const oldScript = document.querySelector('script[src*="webapi.amap.com"]');
        if (oldScript) {
            oldScript.remove();
            console.log('移除了旧脚本');
        }

        // 重置AMap - 使用和快速测试相同的方法
        if (window.AMap) {
            delete window.AMap;
            console.log('重置了AMap对象');
        }

        const script = document.createElement('script');
        script.src = `https://webapi.amap.com/maps?v=1.4.15&key=${key}`;

        script.onload = () => {
            console.log('脚本加载完成');
            if (window.AMap) {
                console.log('AMap对象存在');
                AMap = window.AMap;

                // 测试基本功能 - 使用和快速测试相同的方法
                try {
                    const map = new AMap.Map(document.createElement('div'), {
                        zoom: 11,
                        center: [116.397428, 39.90923]
                    });

                    console.log('地图创建成功');
                    map.destroy(); // 清理测试地图
                    resolve(AMap);

                } catch (error) {
                    console.error('地图创建失败:', error);
                    reject(new Error('地图创建失败: ' + error.message));
                }
            } else {
                console.error('AMap对象未找到');
                reject(new Error('AMap对象未找到'));
            }
        };

        script.onerror = () => {
            console.error('API脚本加载失败');
            reject(new Error('API脚本加载失败，请检查网络连接和API密钥'));
        };

        console.log('开始加载脚本:', script.src);
        document.head.appendChild(script);
    });
}

// 地图初始化
function initMap() {
    map = new AMap.Map('map-container', {
        zoom: 11,
        center: [116.397428, 39.90923],
        mapStyle: 'amap://styles/normal'
    });

    // 使用插件系统加载地图控件
    AMap.plugin(['AMap.ToolBar', 'AMap.Scale'], function() {
        // 添加工具条
        const toolbar = new AMap.ToolBar({
            position: 'RB'
        });
        map.addControl(toolbar);

        // 添加比例尺
        const scale = new AMap.Scale({
            position: 'LB'
        });
        map.addControl(scale);
    });

    // 地图加载完成事件
    map.on('complete', function() {
        console.log('地图加载完成');
    });
}

// 定位功能
function getCurrentLocation() {
    if (!AMap) {
        showNotification('地图API未加载', 'error');
        return;
    }

    const btn = document.getElementById('use-current-location');
    btn.disabled = true;
    btn.textContent = '🔄 定位中...';

    AMap.plugin('AMap.Geolocation', function() {
        const geolocation = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 15000,
            convert: true
        });

        geolocation.getCurrentPosition(function(status, result) {
            btn.disabled = false;
            btn.textContent = '📍 当前位置';

            if (status === 'complete') {
                // 如果有格式化地址，直接使用
                if (result.formattedAddress) {
                    document.getElementById('origin').value = result.formattedAddress;

                    if (map && result.position) {
                        map.setCenter([result.position.lng, result.position.lat]);
                        map.setZoom(15);
                    }

                    showNotification('✅ 定位成功', 'success');
                } else {
                    // 如果没有地址，进行逆地理编码
                    reverseGeocode(result.position, function(address) {
                        document.getElementById('origin').value = address;

                        if (map && result.position) {
                            map.setCenter([result.position.lng, result.position.lat]);
                            map.setZoom(15);
                        }

                        showNotification('✅ 定位成功', 'success');
                    });
                }
            } else {
                showNotification('❌ 定位失败，请检查位置权限', 'error');
            }
        });
    });
}

// 逆地理编码 - 将坐标转换为地址
function reverseGeocode(position, callback) {
    AMap.plugin('AMap.Geocoder', function() {
        const geocoder = new AMap.Geocoder({
            extensions: 'all'
        });

        geocoder.getAddress([position.lng, position.lat], function(status, result) {
            if (status === 'complete' && result.regeocode) {
                const address = result.regeocode.formattedAddress;
                callback(address);
            } else {
                // 如果逆地理编码失败，返回坐标
                callback(`${position.lng.toFixed(6)}, ${position.lat.toFixed(6)}`);
            }
        });
    });
}

function getIPLocation() {
    if (!AMap) {
        showNotification('地图API未加载', 'error');
        return;
    }

    const btn = document.getElementById('use-ip-location');
    btn.disabled = true;
    btn.textContent = '🔄 定位中...';

    AMap.plugin('AMap.CitySearch', function() {
        const citySearch = new AMap.CitySearch();
        
        citySearch.getLocalCity(function(status, result) {
            btn.disabled = false;
            btn.textContent = '🌐 城市定位';

            if (status === 'complete' && result.info === 'OK') {
                document.getElementById('origin').value = result.city;
                
                if (map && result.bounds) {
                    map.setBounds(result.bounds);
                }
                
                showNotification(`✅ IP定位成功: ${result.city}`, 'success');
            } else {
                showNotification('❌ IP定位失败', 'error');
            }
        });
    });
}

// 搜索位置功能
function searchLocation(inputId) {
    const input = document.getElementById(inputId);
    const address = input.value.trim();

    if (!address) {
        showNotification('请输入地址', 'error');
        return;
    }

    if (!AMap) {
        showNotification('地图API未加载', 'error');
        return;
    }

    const searchBtn = document.getElementById(`search-${inputId}`);
    const originalText = searchBtn.textContent;
    searchBtn.textContent = '🔄';
    searchBtn.disabled = true;

    // 进行地理编码搜索
    AMap.plugin('AMap.Geocoder', function() {
        const geocoder = new AMap.Geocoder({
            extensions: 'all'
        });

        geocoder.getLocation(address, function(status, result) {
            searchBtn.textContent = originalText;
            searchBtn.disabled = false;

            if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
                const location = result.geocodes[0];
                const formattedAddress = location.formattedAddress;

                // 更新输入框内容为标准地址
                input.value = formattedAddress;

                // 在地图上显示位置
                if (map && location.location) {
                    map.setCenter([location.location.lng, location.location.lat]);
                    map.setZoom(15);

                    // 添加标记
                    const marker = new AMap.Marker({
                        position: [location.location.lng, location.location.lat],
                        title: formattedAddress
                    });
                    map.add(marker);

                    // 3秒后移除标记
                    setTimeout(() => {
                        map.remove(marker);
                    }, 3000);
                }

                showNotification(`✅ 找到位置: ${location.addressComponent.city || ''}${location.addressComponent.district || ''}`, 'success');
            } else {
                showNotification('❌ 未找到该地址，请尝试更具体的描述', 'error');
            }
        });
    });
}

// 途经点管理
function addWaypoint() {
    const waypointsList = document.getElementById('waypoints-list');
    const waypointIndex = waypoints.length;
    
    const waypointDiv = document.createElement('div');
    waypointDiv.className = 'waypoint-item';
    waypointDiv.innerHTML = `
        <span>📍</span>
        <input type="text" placeholder="途经点 ${waypointIndex + 1}" data-index="${waypointIndex}">
        <button class="remove-waypoint" onclick="removeWaypoint(${waypointIndex})">❌</button>
    `;
    
    waypointsList.appendChild(waypointDiv);
    waypoints.push('');
}

function removeWaypoint(index) {
    const waypointsList = document.getElementById('waypoints-list');
    const waypointItems = waypointsList.querySelectorAll('.waypoint-item');
    
    if (waypointItems[index]) {
        waypointItems[index].remove();
        waypoints.splice(index, 1);
        
        // 重新编号
        updateWaypointNumbers();
    }
}

function updateWaypointNumbers() {
    const waypointInputs = document.querySelectorAll('.waypoint-item input');
    waypointInputs.forEach((input, index) => {
        input.placeholder = `途经点 ${index + 1}`;
        input.setAttribute('data-index', index);
    });
}

// 路线规划
function planRoute() {
    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();
    
    if (!origin || !destination) {
        showNotification('请输入出发地和目的地', 'error');
        return;
    }

    if (!AMap) {
        showNotification('地图API未加载', 'error');
        return;
    }

    // 显示加载状态
    const resultsContainer = document.getElementById('results-list');
    resultsContainer.innerHTML = '<div class="loading">🔄 正在规划最佳路线...</div>';

    // 获取选中的交通方式
    const selectedModes = getSelectedTransportModes();
    
    if (selectedModes.length === 0) {
        showNotification('请至少选择一种交通方式', 'error');
        return;
    }

    // 清除之前的路线
    map.clearMap();
    currentRoutes = [];

    // 规划所有选中的交通方式
    planMultipleRoutes(origin, destination, selectedModes);
}

function getSelectedTransportModes() {
    const modes = [];
    if (document.getElementById('driving').checked) modes.push('driving');
    if (document.getElementById('walking').checked) modes.push('walking');
    if (document.getElementById('transit').checked) modes.push('transit');
    if (document.getElementById('riding').checked) modes.push('riding');
    return modes;
}

function planMultipleRoutes(origin, destination, modes) {
    const results = [];
    let completed = 0;

    modes.forEach(mode => {
        planSingleRoute(origin, destination, mode, (error, result) => {
            completed++;
            if (!error && result) {
                results.push(result);
            }
            
            if (completed === modes.length) {
                currentRoutes = results;
                displayResults(results);
                updateTripSummary(results);
                showActionButtons();
            }
        });
    });
}

function planSingleRoute(origin, destination, mode, callback) {
    // 先进行地理编码
    geocodeAddress(origin, (error1, originCoord) => {
        if (error1) {
            callback(error1);
            return;
        }

        geocodeAddress(destination, (error2, destCoord) => {
            if (error2) {
                callback(error2);
                return;
            }

            // 根据交通方式规划路线
            switch (mode) {
                case 'driving':
                    planDrivingRoute(originCoord, destCoord, callback);
                    break;
                case 'walking':
                    planWalkingRoute(originCoord, destCoord, callback);
                    break;
                case 'transit':
                    planTransitRoute(originCoord, destCoord, callback);
                    break;
                case 'riding':
                    planRidingRoute(originCoord, destCoord, callback);
                    break;
            }
        });
    });
}

function geocodeAddress(address, callback) {
    AMap.plugin('AMap.Geocoder', function() {
        const geocoder = new AMap.Geocoder({
            extensions: 'all'
        });
        
        geocoder.getLocation(address, function(status, result) {
            if (status === 'complete' && result.geocodes.length) {
                callback(null, result.geocodes[0].location);
            } else {
                callback(`地址解析失败: ${address}`);
            }
        });
    });
}

function planDrivingRoute(origin, destination, callback) {
    AMap.plugin('AMap.Driving', function() {
        const driving = new AMap.Driving({
            map: map,
            panel: null
        });
        
        driving.search(origin, destination, function(status, result) {
            if (status === 'complete' && result.routes && result.routes.length > 0) {
                const route = result.routes[0];
                callback(null, {
                    type: '驾车',
                    icon: '🚗',
                    time: Math.round(route.time / 60),
                    distance: (route.distance / 1000).toFixed(1),
                    cost: route.tolls || 0,
                    details: route.steps ? route.steps.slice(0, 3).map(step => step.instruction).join(' → ') : '路线详情',
                    color: '#1890ff'
                });
            } else {
                callback('驾车路线规划失败');
            }
        });
    });
}

function planWalkingRoute(origin, destination, callback) {
    AMap.plugin('AMap.Walking', function() {
        const walking = new AMap.Walking({
            map: map,
            panel: null
        });
        
        walking.search(origin, destination, function(status, result) {
            if (status === 'complete' && result.routes && result.routes.length > 0) {
                const route = result.routes[0];
                callback(null, {
                    type: '步行',
                    icon: '🚶',
                    time: Math.round(route.time / 60),
                    distance: (route.distance / 1000).toFixed(1),
                    cost: 0,
                    details: route.steps ? route.steps.slice(0, 3).map(step => step.instruction).join(' → ') : '步行路线',
                    color: '#52c41a'
                });
            } else {
                callback('步行路线规划失败');
            }
        });
    });
}

function planTransitRoute(origin, destination, callback) {
    AMap.plugin('AMap.Transfer', function() {
        const transfer = new AMap.Transfer({
            map: map,
            panel: null,
            city: '北京'
        });
        
        transfer.search(origin, destination, function(status, result) {
            if (status === 'complete' && result.plans && result.plans.length > 0) {
                const plan = result.plans[0];
                callback(null, {
                    type: '公共交通',
                    icon: '🚌',
                    time: Math.round(plan.time / 60),
                    distance: (plan.distance / 1000).toFixed(1),
                    cost: plan.cost || 0,
                    details: plan.segments ? plan.segments.slice(0, 3).map(seg => {
                        if (seg.transit_mode === 'WALK') return '步行';
                        return seg.transit && seg.transit[0] ? seg.transit[0].name : '换乘';
                    }).join(' → ') : '公交路线',
                    color: '#fa8c16'
                });
            } else {
                callback('公共交通路线规划失败');
            }
        });
    });
}

function planRidingRoute(origin, destination, callback) {
    AMap.plugin('AMap.Riding', function() {
        const riding = new AMap.Riding({
            map: map,
            panel: null
        });
        
        riding.search(origin, destination, function(status, result) {
            if (status === 'complete' && result.routes && result.routes.length > 0) {
                const route = result.routes[0];
                callback(null, {
                    type: '骑行',
                    icon: '🚴',
                    time: Math.round(route.time / 60),
                    distance: (route.distance / 1000).toFixed(1),
                    cost: 0,
                    details: route.rides ? route.rides.slice(0, 3).map(step => step.instruction).join(' → ') : '骑行路线',
                    color: '#722ed1'
                });
            } else {
                callback('骑行路线规划失败');
            }
        });
    });
}

// 结果显示
function displayResults(results) {
    const resultsContainer = document.getElementById('results-list');
    
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<div class="error">❌ 未找到合适的路线方案</div>';
        return;
    }

    // 按当前排序方式排序
    const sortBy = document.getElementById('sort-by').value;
    sortResultsByType(results, sortBy);

    const html = results.map((route, index) => `
        <div class="route-item" onclick="highlightRoute(${index})" style="border-left-color: ${route.color}">
            <div class="route-header">
                <span class="transport-type">${route.icon} ${route.type}</span>
                <span class="route-time">${route.time}分钟</span>
            </div>
            <div class="route-info">
                <div class="route-distance">距离: ${route.distance}公里</div>
                ${route.cost > 0 ? `<div class="route-cost">费用: ¥${route.cost}</div>` : ''}
                <div style="margin-top: 8px; font-size: 12px; color: #888;">
                    ${route.details}
                </div>
            </div>
        </div>
    `).join('');

    resultsContainer.innerHTML = html;
}

function sortResults() {
    if (currentRoutes.length > 0) {
        displayResults(currentRoutes);
    }
}

function sortResultsByType(results, sortBy) {
    switch (sortBy) {
        case 'time':
            results.sort((a, b) => a.time - b.time);
            break;
        case 'distance':
            results.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
            break;
        case 'cost':
            results.sort((a, b) => a.cost - b.cost);
            break;
    }
}

function highlightRoute(index) {
    // 高亮选中的路线
    const routeItems = document.querySelectorAll('.route-item');
    routeItems.forEach((item, i) => {
        if (i === index) {
            item.style.transform = 'translateX(10px)';
            item.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
        } else {
            item.style.transform = 'translateX(0)';
            item.style.boxShadow = 'none';
        }
    });
}

function updateTripSummary(results) {
    if (results.length === 0) return;

    const summary = document.getElementById('trip-summary');
    const bestRoute = results[0]; // 假设第一个是最佳路线

    document.getElementById('total-distance').textContent = bestRoute.distance + '公里';
    document.getElementById('total-time').textContent = bestRoute.time + '分钟';
    document.getElementById('total-cost').textContent = bestRoute.cost > 0 ? '¥' + bestRoute.cost : '免费';
    document.getElementById('recommended-mode').textContent = bestRoute.type;

    summary.style.display = 'block';
}

function showActionButtons() {
    document.getElementById('save-plan').style.display = 'block';
    document.getElementById('export-plan').style.display = 'block';
}

// 快捷操作
function clearAll() {
    document.getElementById('origin').value = '';
    document.getElementById('destination').value = '';
    document.getElementById('waypoints-list').innerHTML = '';
    document.getElementById('results-list').innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">🗺️</div>
            <h4>重新开始规划</h4>
            <p>设置新的出发地和目的地，开始规划你的旅程</p>
        </div>
    `;
    document.getElementById('trip-summary').style.display = 'none';
    document.getElementById('save-plan').style.display = 'none';
    document.getElementById('export-plan').style.display = 'none';
    
    waypoints = [];
    currentRoutes = [];
    
    if (map) {
        map.clearMap();
        map.setCenter([116.397428, 39.90923]);
        map.setZoom(11);
    }
}

function reverseRoute() {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    
    document.getElementById('origin').value = destination;
    document.getElementById('destination').value = origin;
    
    showNotification('✅ 起终点已互换', 'success');
}

// 地图控制
function centerMap() {
    if (map && currentRoutes.length > 0) {
        // 居中显示所有路线
        map.setFitView();
    }
}

function toggleSatelliteView() {
    if (map) {
        const currentStyle = map.getMapStyle();
        if (currentStyle === 'amap://styles/satellite') {
            map.setMapStyle('amap://styles/normal');
            document.getElementById('satellite-view').textContent = '🛰️ 卫星视图';
        } else {
            map.setMapStyle('amap://styles/satellite');
            document.getElementById('satellite-view').textContent = '🗺️ 标准视图';
        }
    }
}

function toggleTrafficView() {
    if (map) {
        // 检查是否已有交通图层
        const layers = map.getLayers();
        let trafficLayer = null;

        for (let i = 0; i < layers.length; i++) {
            if (layers[i].CLASS_NAME === 'AMap.TileLayer.Traffic') {
                trafficLayer = layers[i];
                break;
            }
        }

        if (trafficLayer) {
            map.remove(trafficLayer);
            document.getElementById('traffic-view').textContent = '🚦 实时路况';
        } else {
            // 使用插件加载交通图层
            AMap.plugin('AMap.TileLayer.Traffic', function() {
                const traffic = new AMap.TileLayer.Traffic({
                    zIndex: 10
                });
                map.add(traffic);
                document.getElementById('traffic-view').textContent = '❌ 关闭路况';
            });
        }
    }
}

// 保存和导出
function savePlan() {
    if (currentRoutes.length === 0) {
        showNotification('没有可保存的路线方案', 'error');
        return;
    }

    const planName = prompt('请输入方案名称:', `旅行计划_${new Date().toLocaleDateString()}`);
    if (!planName) return;

    const plan = {
        name: planName,
        origin: document.getElementById('origin').value,
        destination: document.getElementById('destination').value,
        waypoints: waypoints,
        routes: currentRoutes,
        timestamp: new Date().toISOString()
    };

    const savedPlans = JSON.parse(localStorage.getItem(SAVED_PLANS_STORAGE) || '[]');
    savedPlans.push(plan);
    localStorage.setItem(SAVED_PLANS_STORAGE, JSON.stringify(savedPlans));

    showNotification('✅ 方案已保存', 'success');
}

function exportPlan() {
    if (currentRoutes.length === 0) {
        showNotification('没有可导出的路线方案', 'error');
        return;
    }

    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    const timestamp = new Date().toLocaleString();

    let exportText = `🌟 旅游路线规划报告\n`;
    exportText += `生成时间: ${timestamp}\n\n`;
    exportText += `📍 出发地: ${origin}\n`;
    exportText += `🎯 目的地: ${destination}\n\n`;
    exportText += `📊 路线方案对比:\n\n`;

    currentRoutes.forEach((route, index) => {
        exportText += `${index + 1}. ${route.icon} ${route.type}\n`;
        exportText += `   ⏱️ 时间: ${route.time}分钟\n`;
        exportText += `   📏 距离: ${route.distance}公里\n`;
        exportText += `   💰 费用: ${route.cost > 0 ? '¥' + route.cost : '免费'}\n`;
        exportText += `   📝 路线: ${route.details}\n\n`;
    });

    exportText += `\n📱 由智能旅游路线规划助手生成`;

    // 创建下载链接
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `旅游路线规划_${origin}_${destination}_${new Date().toLocaleDateString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('✅ 行程已导出', 'success');
}

// 通知系统
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;

    switch (type) {
        case 'success':
            notification.style.background = '#52c41a';
            break;
        case 'error':
            notification.style.background = '#ff4d4f';
            break;
        default:
            notification.style.background = '#1890ff';
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .loading {
        text-align: center;
        padding: 40px 20px;
        color: #667eea;
        font-size: 16px;
    }
    .error {
        text-align: center;
        padding: 40px 20px;
        color: #ff4d4f;
        font-size: 16px;
    }
`;
document.head.appendChild(style);
