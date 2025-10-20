// 高德地图配置
let map;
let AMap;
let apiKey = null;

// API密钥管理
const API_KEY_STORAGE = 'amap_api_key';

// 从本地存储获取API密钥
function getStoredApiKey() {
    return localStorage.getItem(API_KEY_STORAGE);
}

// 保存API密钥到本地存储
function saveApiKey(key) {
    localStorage.setItem(API_KEY_STORAGE, key);
    apiKey = key;
}

// 清除API密钥
function clearApiKey() {
    localStorage.removeItem(API_KEY_STORAGE);
    apiKey = null;
}

// 动态加载高德地图API
function loadAmapAPI(key) {
    return new Promise((resolve, reject) => {
        // 如果已经加载过，直接返回
        if (window.AMap) {
            resolve(window.AMap);
            return;
        }

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = `https://webapi.amap.com/maps?v=1.4.15&key=${key}`;

        script.onload = function() {
            if (window.AMap) {
                AMap = window.AMap;
                resolve(AMap);
            } else {
                reject(new Error('高德地图API加载失败'));
            }
        };

        script.onerror = function() {
            reject(new Error('高德地图API加载失败，请检查网络连接和API密钥'));
        };

        document.head.appendChild(script);
    });
}

// 验证API密钥
function validateApiKey(key) {
    if (!key || key.trim().length === 0) {
        return false;
    }
    // 基本格式验证（高德API密钥通常是32位字符）
    return key.trim().length >= 20;
}

// 显示API设置界面
function showApiSetup() {
    document.getElementById('api-setup').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
}

// 隐藏API设置界面
function hideApiSetup() {
    document.getElementById('api-setup').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
}

// 定位功能
let currentLocationData = null;

// 显示定位状态
function showLocationStatus(message, type = 'loading') {
    const originInput = document.getElementById('origin');
    let statusDiv = document.querySelector('.location-status');

    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.className = 'location-status';
        originInput.parentNode.appendChild(statusDiv);
    }

    statusDiv.className = `location-status ${type}`;
    statusDiv.textContent = message;

    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            if (statusDiv && statusDiv.parentNode) {
                statusDiv.parentNode.removeChild(statusDiv);
            }
        }, 3000);
    }
}

// 使用浏览器精确定位
function getCurrentLocation() {
    if (!AMap) {
        showLocationStatus('地图API未加载', 'error');
        return;
    }

    showLocationStatus('🔄 正在获取当前位置...', 'loading');

    // 禁用定位按钮
    const currentBtn = document.getElementById('use-current-location');
    const ipBtn = document.getElementById('use-ip-location');
    currentBtn.disabled = true;
    ipBtn.disabled = true;

    AMap.plugin('AMap.Geolocation', function() {
        const geolocation = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
            convert: true,
            showButton: false,
            showMarker: false,
            showCircle: false
        });

        geolocation.getCurrentPosition(function(status, result) {
            currentBtn.disabled = false;
            ipBtn.disabled = false;

            if (status === 'complete') {
                currentLocationData = result;

                // 如果有格式化地址，直接使用
                if (result.formattedAddress && result.formattedAddress.length > 10) {
                    document.getElementById('origin').value = result.formattedAddress;
                    const city = result.addressComponent ? (result.addressComponent.city || result.addressComponent.district || '') : '';
                    showLocationStatus(`✅ 定位成功: ${city}`, 'success');

                    // 将地图中心移动到当前位置
                    if (map && result.position) {
                        map.setCenter([result.position.lng, result.position.lat]);
                        map.setZoom(15);
                    }
                } else {
                    // 如果没有地址或地址太短，进行逆地理编码
                    showLocationStatus('🔄 正在解析地址...', 'loading');
                    reverseGeocode(result.position, function(address) {
                        document.getElementById('origin').value = address;
                        showLocationStatus(`✅ 定位成功`, 'success');

                        // 将地图中心移动到当前位置
                        if (map && result.position) {
                            map.setCenter([result.position.lng, result.position.lat]);
                            map.setZoom(15);
                        }
                    });
                }
            } else {
                console.error('定位失败:', result);
                let errorMsg = '请检查定位权限';
                if (result && result.message) {
                    errorMsg = result.message;
                } else if (result && result.info) {
                    errorMsg = result.info;
                }

                showLocationStatus(`❌ 定位失败: ${errorMsg}`, 'error');

                // 显示详细的错误提示
                setTimeout(() => {
                    showLocationStatus(`💡 提示: 请允许浏览器访问位置权限，或尝试关闭广告拦截器`, 'error');
                }, 3000);
            }
        });
    });
}

// 逆地理编码 - 将坐标转换为地址（专注国内坐标）
function reverseGeocode(position, callback) {
    console.log('开始逆地理编码:', position);

    AMap.plugin('AMap.Geocoder', function() {
        const geocoder = new AMap.Geocoder({
            city: '全国',
            extensions: 'all',
            radius: 1000
        });

        geocoder.getAddress([position.lng, position.lat], function(status, result) {
            console.log('逆地理编码结果:', status, result);

            if (status === 'complete' && result.regeocode && result.regeocode.formattedAddress) {
                const address = result.regeocode.formattedAddress;
                console.log('逆地理编码成功:', address);
                callback(address);
            } else {
                console.error('逆地理编码失败，可能是海外坐标或网络问题');
                // 如果逆地理编码失败，提示用户关闭VPN
                callback(`坐标: ${position.lng.toFixed(6)}, ${position.lat.toFixed(6)} (请关闭VPN后重试)`);
            }
        });
    });
}

// 使用IP定位获取城市信息
function getIPLocation() {
    if (!AMap) {
        showLocationStatus('地图API未加载', 'error');
        return;
    }

    showLocationStatus('🔄 正在获取IP位置...', 'loading');

    // 禁用定位按钮
    const currentBtn = document.getElementById('use-current-location');
    const ipBtn = document.getElementById('use-ip-location');
    currentBtn.disabled = true;
    ipBtn.disabled = true;

    // 方法1: 使用AMap.CitySearch
    AMap.plugin('AMap.CitySearch', function() {
        const citySearch = new AMap.CitySearch();

        citySearch.getLocalCity(function(status, result) {
            console.log('IP定位结果:', status, result);

            if (status === 'complete' && result && result.info === 'OK' && result.city) {
                const cityName = result.city;
                const bounds = result.bounds;

                document.getElementById('origin').value = cityName;
                showLocationStatus(`✅ IP定位成功: ${cityName}`, 'success');

                // 将地图中心移动到城市中心
                if (map && bounds) {
                    map.setBounds(bounds);
                }

                currentBtn.disabled = false;
                ipBtn.disabled = false;
            } else {
                console.error('AMap.CitySearch失败，尝试备用方案');
                // 备用方案：使用浏览器的地理位置API
                tryBrowserGeolocation();
            }
        });
    });

    // 备用方案：使用浏览器原生定位
    function tryBrowserGeolocation() {
        if (navigator.geolocation) {
            showLocationStatus('🔄 尝试浏览器定位...', 'loading');

            navigator.geolocation.getCurrentPosition(
                function(position) {
                    // 使用获取到的坐标进行逆地理编码
                    const pos = {
                        lng: position.coords.longitude,
                        lat: position.coords.latitude
                    };

                    reverseGeocode(pos, function(address) {
                        document.getElementById('origin').value = address;
                        showLocationStatus(`✅ 浏览器定位成功`, 'success');

                        if (map) {
                            map.setCenter([pos.lng, pos.lat]);
                            map.setZoom(12);
                        }

                        currentBtn.disabled = false;
                        ipBtn.disabled = false;
                    });
                },
                function(error) {
                    console.error('浏览器定位也失败:', error);
                    // 最后的备用方案：设置默认城市
                    document.getElementById('origin').value = '北京市';
                    showLocationStatus('❌ 定位失败，已设置为北京市，请手动修改', 'error');

                    currentBtn.disabled = false;
                    ipBtn.disabled = false;
                },
                {
                    timeout: 10000,
                    enableHighAccuracy: false
                }
            );
        } else {
            // 浏览器不支持定位
            document.getElementById('origin').value = '北京市';
            showLocationStatus('❌ 浏览器不支持定位，已设置为北京市，请手动修改', 'error');

            currentBtn.disabled = false;
            ipBtn.disabled = false;
        }
    }
}

// 初始化地图
function initMap() {
    map = new AMap.Map('map-container', {
        zoom: 11,
        center: [116.397428, 39.90923], // 北京天安门
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
}

// 地理编码服务
function geocode(address, callback) {
    console.log('开始地理编码:', address);

    // 检查缓存
    if (geocodeCache[address]) {
        console.log('使用缓存的地理编码结果:', address);
        setTimeout(() => {
            callback(null, geocodeCache[address]);
        }, 10); // 异步调用，避免同步问题
        return;
    }

    // 预处理地址，移除可能导致问题的字符
    const cleanAddress = preprocessAddress(address);
    console.log('预处理后地址:', cleanAddress);

    AMap.plugin('AMap.Geocoder', function() {
        const geocoder = new AMap.Geocoder({
            city: '全国',
            extensions: 'all',
            batch: false
        });

        // 首先尝试原始地址
        tryGeocode(geocoder, address, function(success, result) {
            if (success) {
                callback(null, result);
            } else {
                // 如果原始地址失败，尝试清理后的地址
                console.log('原始地址失败，尝试清理后的地址:', cleanAddress);
                tryGeocode(geocoder, cleanAddress, function(success2, result2) {
                    if (success2) {
                        callback(null, result2);
                    } else {
                        // 如果还是失败，尝试提取关键词
                        const keywords = extractKeywords(address);
                        console.log('尝试关键词搜索:', keywords);
                        tryGeocode(geocoder, keywords, function(success3, result3) {
                            if (success3) {
                                callback(null, result3);
                            } else {
                                callback(`地址解析失败: ${address}，请尝试更简单的地址描述`);
                            }
                        });
                    }
                });
            }
        });
    });
}

// 预处理地址，移除可能导致问题的字符
function preprocessAddress(address) {
    return address
        .replace(/[()（）]/g, '') // 移除括号
        .replace(/\s+/g, '') // 移除多余空格
        .replace(/[^\u4e00-\u9fa5\w\s]/g, '') // 只保留中文、字母、数字和空格
        .trim();
}

// 提取地址关键词
function extractKeywords(address) {
    // 提取城市名、区名、主要地标
    const cityMatch = address.match(/(北京|上海|广州|深圳|杭州|南京|武汉|成都|重庆|天津|西安|青岛|大连|厦门|苏州|无锡|宁波|长沙|郑州|济南|哈尔滨|沈阳|长春|石家庄|太原|呼和浩特|兰州|西宁|银川|乌鲁木齐|拉萨|昆明|贵阳|南宁|海口|三亚|福州|南昌|合肥)/);
    const districtMatch = address.match(/(朝阳|海淀|丰台|石景山|东城|西城|通州|昌平|大兴|房山|门头沟|平谷|密云|延庆|怀柔|顺义)/);

    let keywords = '';
    if (cityMatch) keywords += cityMatch[1];
    if (districtMatch) keywords += districtMatch[1];

    // 如果没有找到城市区域，尝试提取前几个字符
    if (!keywords) {
        keywords = address.substring(0, Math.min(6, address.length));
    }

    return keywords || address;
}

// 尝试地理编码
function tryGeocode(geocoder, address, callback) {
    geocoder.getLocation(address, function(status, result) {
        console.log(`地理编码 "${address}" 结果:`, status, result);

        if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
            const geocode = result.geocodes[0];
            console.log('地理编码成功:');
            console.log('- 输入地址:', address);
            console.log('- 解析地址:', geocode.formattedAddress);
            console.log('- 坐标:', geocode.location);

            // 验证坐标有效性
            if (geocode.location &&
                geocode.location.lng && geocode.location.lat &&
                !isNaN(geocode.location.lng) && !isNaN(geocode.location.lat) &&
                geocode.location.lng !== 0 && geocode.location.lat !== 0) {

                // 保存到缓存
                geocodeCache[address] = geocode.location;
                console.log('地理编码结果已缓存:', address);

                callback(true, geocode.location);
            } else {
                console.error('获取到无效坐标:', geocode.location);
                callback(false, null);
            }
        } else {
            console.error('地理编码失败:', status, result);

            // 分析具体的错误类型
            if (status === 'error' && result && result.info) {
                console.error('错误详情:', result.info);
                if (result.info.includes('ENGINE_RESPONSE_DATA_ERROR')) {
                    console.error('这是API数据引擎错误，可能是地址格式问题或API限制');
                }
            }

            callback(false, null);
        }
    });
}

// 路径规划
function planRoute(origin, destination) {
    const resultsContainer = document.getElementById('results-list');
    resultsContainer.innerHTML = '<div class="loading">🔄 正在规划路线...</div>';

    // 清除之前的路线
    if (map) {
        map.clearMap();
    }

    // 规划选中的交通方式路线
    planSelectedRoutes(origin, destination);
}

// 初始化交通方式卡片交互
function initTransportCards() {
    const cards = document.querySelectorAll('.transport-card');

    cards.forEach(card => {
        // 初始状态设置
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox.checked) {
            card.classList.add('selected');
        }

        // 点击事件
        card.addEventListener('click', function() {
            const checkbox = this.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;

            if (checkbox.checked) {
                this.classList.add('selected');
                // 添加选中动画
                this.style.animation = 'cardSelect 0.3s ease';
            } else {
                this.classList.remove('selected');
                // 添加取消选中动画
                this.style.animation = 'cardDeselect 0.3s ease';
            }

            // 清除动画
            setTimeout(() => {
                this.style.animation = '';
            }, 300);

            console.log('交通方式选择更新:', getSelectedTransportModes());
        });

        // 悬停效果增强
        card.addEventListener('mouseenter', function() {
            if (!this.classList.contains('selected')) {
                this.style.transform = 'translateY(-6px) scale(1.02)';
            }
        });

        card.addEventListener('mouseleave', function() {
            if (!this.classList.contains('selected')) {
                this.style.transform = 'translateY(0) scale(1)';
            }
        });
    });
}

// 获取选中的交通方式
function getSelectedTransportModes() {
    const modes = [];
    if (document.getElementById('driving').checked) modes.push('driving');
    if (document.getElementById('walking').checked) modes.push('walking');
    if (document.getElementById('transit').checked) modes.push('transit');
    if (document.getElementById('riding').checked) modes.push('riding');
    return modes;
}

// 规划选中交通方式的路线
function planSelectedRoutes(origin, destination) {
    const selectedModes = getSelectedTransportModes();

    if (selectedModes.length === 0) {
        alert('请至少选择一种交通方式');
        return;
    }

    console.log('规划交通方式:', selectedModes);
    const allResults = [];
    let completed = 0;

    selectedModes.forEach(mode => {
        planSingleRoute(origin, destination, mode, (error, result) => {
            completed++;
            if (!error && result) {
                // result 可能是单个对象或数组
                if (Array.isArray(result)) {
                    allResults.push(...result);
                } else {
                    allResults.push(result);
                }
            }

            if (completed === selectedModes.length) {
                console.log('所有路线规划完成，总计:', allResults.length, '条路线');
                displayResults(allResults);
            }
        });
    });
}

// 规划单一交通方式的路线
function planSingleRoute(origin, destination, mode, callback) {
    let routeService;

    switch (mode) {
        case 'driving':
            AMap.plugin('AMap.Driving', function() {
                routeService = new AMap.Driving({
                    map: null, // 初始不显示在地图上
                    panel: null
                });

                // 使用坐标进行路线规划
                routeService.search(origin, destination, function(status, result) {
                    if (status === 'complete' && result.routes && result.routes.length > 0) {
                        // 显示多条路线选择
                        const routes = result.routes.slice(0, 3); // 最多显示3条路线
                        const routeResults = routes.map((route, index) => ({
                            type: `驾车路线${index + 1}`,
                            icon: '🚗',
                            time: Math.round(route.time / 60),
                            distance: (route.distance / 1000).toFixed(1),
                            tolls: route.tolls || 0,
                            details: route.steps ? route.steps.slice(0, 3).map(step => step.instruction).join(' → ') : '路线详情',
                            color: index === 0 ? '#1890ff' : '#52c41a',
                            routeIndex: index
                        }));

                        callback && callback(null, routeResults);
                        if (!callback) displayResults(routeResults);
                    } else {
                        console.error('驾车路线规划失败:', status, result);
                        callback && callback('驾车路线规划失败: ' + (result ? result.info || status : status));
                    }
                });
            });
            break;

        case 'walking':
            AMap.plugin('AMap.Walking', function() {
                routeService = new AMap.Walking({
                    map: null, // 初始不显示在地图上
                    panel: null
                });

                routeService.search(origin, destination, function(status, result) {
                    if (status === 'complete' && result.routes && result.routes.length > 0) {
                        // 显示多条步行路线
                        const routes = result.routes.slice(0, 2); // 最多显示2条路线
                        const routeResults = routes.map((route, index) => ({
                            type: `步行路线${index + 1}`,
                            icon: '🚶',
                            time: Math.round(route.time / 60),
                            distance: (route.distance / 1000).toFixed(1),
                            tolls: 0,
                            details: route.steps ? route.steps.slice(0, 3).map(step => step.instruction).join(' → ') : '路线详情',
                            color: index === 0 ? '#52c41a' : '#13c2c2',
                            routeIndex: index
                        }));

                        callback && callback(null, routeResults);
                        if (!callback) displayResults(routeResults);
                    } else {
                        console.error('步行路线规划失败:', status, result);
                        callback && callback('步行路线规划失败: ' + (result ? result.info || status : status));
                    }
                });
            });
            break;

        case 'transit':
            AMap.plugin('AMap.Transfer', function() {
                routeService = new AMap.Transfer({
                    map: null, // 初始不显示在地图上
                    panel: null,
                    city: '全国'
                });

                routeService.search(origin, destination, function(status, result) {
                    if (status === 'complete' && result.plans && result.plans.length > 0) {
                        // 显示多个公交方案
                        const plans = result.plans.slice(0, 3); // 最多显示3个方案
                        const routeResults = plans.map((plan, index) => ({
                            type: `公交方案${index + 1}`,
                            icon: '🚌',
                            time: Math.round(plan.time / 60),
                            distance: (plan.distance / 1000).toFixed(1),
                            tolls: plan.cost || 0,
                            details: plan.segments ? plan.segments.slice(0, 3).map(seg => {
                                if (seg.transit_mode === 'WALK') return '步行';
                                if (seg.transit && seg.transit.length > 0) {
                                    return `${seg.transit[0].name}`;
                                }
                                return seg.instruction || '换乘';
                            }).join(' → ') : '公交路线',
                            color: index === 0 ? '#fa8c16' : '#eb2f96',
                            routeIndex: index
                        }));

                        callback && callback(null, routeResults);
                        if (!callback) displayResults(routeResults);
                    } else {
                        console.error('公共交通路线规划失败:', status, result);
                        callback && callback('公共交通路线规划失败: ' + (result ? result.info || status : status));
                    }
                });
            });
            break;

        case 'riding':
            AMap.plugin('AMap.Riding', function() {
                routeService = new AMap.Riding({
                    map: null, // 初始不显示在地图上
                    panel: null
                });

                routeService.search(origin, destination, function(status, result) {
                    if (status === 'complete' && result.routes && result.routes.length > 0) {
                        // 显示多条骑行路线
                        const routes = result.routes.slice(0, 2); // 最多显示2条路线
                        const routeResults = routes.map((route, index) => ({
                            type: `骑行路线${index + 1}`,
                            icon: '🚴',
                            time: Math.round(route.time / 60),
                            distance: (route.distance / 1000).toFixed(1),
                            tolls: 0,
                            details: route.rides ? route.rides.slice(0, 3).map(step => step.instruction).join(' → ') : '骑行路线',
                            color: index === 0 ? '#722ed1' : '#f759ab',
                            routeIndex: index
                        }));

                        callback && callback(null, routeResults);
                        if (!callback) displayResults(routeResults);
                    } else {
                        console.error('骑行路线规划失败:', status, result);
                        callback && callback('骑行路线规划失败: ' + (result ? result.info || status : status));
                    }
                });
            });
            break;
    }
}

// 显示结果
function displayResults(results) {
    const resultsContainer = document.getElementById('results-list');

    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<div class="error">❌ 未找到合适的路线方案</div>';
        return;
    }

    console.log('显示路线结果:', results.length, '条路线');

    // 按时间排序
    results.sort((a, b) => a.time - b.time);

    // 添加使用提示
    let tipsHtml = '';
    if (results.length > 0) {
        tipsHtml = `
            <div class="route-tips">
                <span class="tips-icon">💡</span>
                <span class="tips-text">点击路线卡片在地图上查看详细路径</span>
            </div>
        `;
    }

    const html = tipsHtml + results.map((route, index) => `
        <div class="route-item" style="border-left-color: ${route.color || '#1890ff'};" data-route-index="${index}">
            <div class="route-header" onclick="highlightRoute(${index})">
                <span class="transport-type">${route.icon} ${route.type}</span>
                <span class="route-time">${route.time}分钟</span>
            </div>
            <div class="route-info">
                <div class="route-distance">距离: ${route.distance}公里</div>
                ${route.tolls > 0 ? `<div class="route-cost">费用: ¥${route.tolls}</div>` : ''}
                <div class="route-summary">
                    ${route.details && route.details.length > 80 ? route.details.substring(0, 80) + '...' : route.details || '路线详情'}
                </div>
            </div>
            <div class="route-actions">
                <button class="action-btn view-map-btn" onclick="highlightRoute(${index})" title="在地图上查看">
                    🗺️ 地图查看
                </button>
                <button class="action-btn details-btn" onclick="toggleRouteDetails(${index})" title="查看详细步骤">
                    📋 详细步骤
                </button>
            </div>
            <div class="route-details" id="route-details-${index}" style="display: none;">
                <div class="details-header">
                    <span class="details-title">📋 详细路线步骤</span>
                    <button class="close-details" onclick="toggleRouteDetails(${index})">✕</button>
                </div>
                <div class="details-content" id="route-steps-${index}">
                    <div class="loading-steps">🔄 正在加载详细步骤...</div>
                </div>
            </div>

        </div>
    `).join('');

    resultsContainer.innerHTML = html;

    // 保存结果供后续使用
    window.currentRoutes = results;
}

// 存储路线服务对象
let routeServices = [];

// 高亮选中的路线并在地图上显示
function highlightRoute(index) {
    const routeItems = document.querySelectorAll('.route-item');

    // 更新卡片视觉效果
    routeItems.forEach((item, i) => {
        if (i === index) {
            item.style.transform = 'translateX(5px)';
            item.style.boxShadow = '0 5px 15px rgba(0,0,0,0.15)';
            item.style.background = '#f0f8ff';
            item.style.borderLeftWidth = '4px';
        } else {
            item.style.transform = 'translateX(0)';
            item.style.boxShadow = 'none';
            item.style.background = '#f8f9fa';
            item.style.borderLeftWidth = '2px';
        }
    });

    // 在地图上切换显示对应路线
    if (window.currentRoutes && window.currentRoutes[index]) {
        const selectedRoute = window.currentRoutes[index];
        console.log('切换到路线:', index, selectedRoute);

        // 隐藏所有路线
        hideAllRoutes();

        // 显示选中的路线
        showSingleRoute(selectedRoute, index);

        // 更新地图视角
        if (map) {
            map.setFitView();
        }
    }
}

// 隐藏地图上的所有路线
function hideAllRoutes() {
    if (map) {
        // 清除所有覆盖物
        map.clearMap();
    }

    // 隐藏所有路线服务的显示
    routeServices.forEach(service => {
        if (service && service.clear) {
            service.clear();
        }
    });
}

// 在地图上显示单条路线
function showSingleRoute(routeData, index) {
    if (!map || !routeData) return;

    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();

    if (!origin || !destination) return;

    // 根据路线类型重新规划并显示
    const mode = routeData.type.includes('驾车') ? 'driving' :
                 routeData.type.includes('步行') ? 'walking' :
                 routeData.type.includes('公交') ? 'transit' :
                 routeData.type.includes('骑行') ? 'riding' : 'driving';

    console.log('重新显示路线:', mode, 'for', origin, 'to', destination);

    // 地理编码并显示路线
    geocode(origin, function(error1, originCoord) {
        if (error1) return;

        geocode(destination, function(error2, destCoord) {
            if (error2) return;

            // 创建新的路线服务并显示
            createAndShowRoute(mode, originCoord, destCoord, index);
        });
    });
}

// 创建并显示特定的路线
function createAndShowRoute(mode, origin, destination, routeIndex) {
    switch (mode) {
        case 'driving':
            AMap.plugin('AMap.Driving', function() {
                const driving = new AMap.Driving({
                    map: map,
                    hideMarkers: false,
                    autoFitView: true,
                    showTraffic: true
                });

                driving.search(origin, destination, function(status, result) {
                    if (status === 'complete' && result.routes && result.routes.length > 0) {
                        console.log('驾车路线显示成功');
                    }
                });

                routeServices[routeIndex] = driving;
            });
            break;

        case 'walking':
            AMap.plugin('AMap.Walking', function() {
                const walking = new AMap.Walking({
                    map: map,
                    hideMarkers: false,
                    autoFitView: true
                });

                walking.search(origin, destination, function(status, result) {
                    if (status === 'complete' && result.routes && result.routes.length > 0) {
                        console.log('步行路线显示成功');
                    }
                });

                routeServices[routeIndex] = walking;
            });
            break;

        case 'transit':
            AMap.plugin('AMap.Transfer', function() {
                const transfer = new AMap.Transfer({
                    map: map,
                    hideMarkers: false,
                    autoFitView: true,
                    city: '全国'
                });

                transfer.search(origin, destination, function(status, result) {
                    if (status === 'complete' && result.plans && result.plans.length > 0) {
                        console.log('公交路线显示成功');
                    }
                });

                routeServices[routeIndex] = transfer;
            });
            break;

        case 'riding':
            AMap.plugin('AMap.Riding', function() {
                const riding = new AMap.Riding({
                    map: map,
                    hideMarkers: false,
                    autoFitView: true
                });

                riding.search(origin, destination, function(status, result) {
                    if (status === 'complete' && result.routes && result.routes.length > 0) {
                        console.log('骑行路线显示成功');
                    }
                });

                routeServices[routeIndex] = riding;
            });
            break;
    }
}

// 初始化应用
function initApp() {
    const storedKey = getStoredApiKey();

    if (storedKey && validateApiKey(storedKey)) {
        // 有有效的API密钥，加载地图
        apiKey = storedKey;
        loadAmapAPI(apiKey)
            .then(() => {
                initMap();
                hideApiSetup();
            })
            .catch(error => {
                console.error('地图加载失败:', error);
                showApiSetup();
                showError('API密钥可能无效，请重新设置');
            });
    } else {
        // 没有API密钥，显示设置界面
        showApiSetup();
    }
}

// 显示错误信息
function showError(message) {
    const resultsContainer = document.getElementById('results-list');
    if (resultsContainer) {
        resultsContainer.innerHTML = `<div class="error">❌ ${message}</div>`;
    }
}

// 事件监听
document.addEventListener('DOMContentLoaded', function() {
    // 初始化应用
    initApp();

    // 初始化交通方式卡片
    initTransportCards();

    // 初始化自动补全
    initAutocomplete();

    // API密钥设置相关事件
    const apiKeyInput = document.getElementById('api-key-input');
    const toggleVisibilityBtn = document.getElementById('toggle-api-visibility');
    const saveApiBtn = document.getElementById('save-api-key');
    const getHelpBtn = document.getElementById('get-api-help');
    const changeApiBtn = document.getElementById('change-api-key');
    const apiHelp = document.getElementById('api-help');

    // 切换密钥可见性
    toggleVisibilityBtn.addEventListener('click', function() {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleVisibilityBtn.textContent = '🙈';
        } else {
            apiKeyInput.type = 'password';
            toggleVisibilityBtn.textContent = '👁️';
        }
    });

    // 保存API密钥
    saveApiBtn.addEventListener('click', function() {
        const key = apiKeyInput.value.trim();

        if (!validateApiKey(key)) {
            alert('请输入有效的API密钥（至少20个字符）');
            return;
        }

        // 显示加载状态
        saveApiBtn.textContent = '🔄 验证中...';
        saveApiBtn.disabled = true;

        // 尝试加载地图API
        loadAmapAPI(key)
            .then(() => {
                saveApiKey(key);
                initMap();
                hideApiSetup();

                // 清空输入框
                apiKeyInput.value = '';
                apiKeyInput.type = 'password';
                toggleVisibilityBtn.textContent = '👁️';

                alert('✅ API密钥设置成功！');
            })
            .catch(error => {
                console.error('API验证失败:', error);
                alert('❌ API密钥验证失败，请检查密钥是否正确');
            })
            .finally(() => {
                saveApiBtn.textContent = '💾 保存并开始使用';
                saveApiBtn.disabled = false;
            });
    });

    // 显示/隐藏帮助信息
    getHelpBtn.addEventListener('click', function() {
        if (apiHelp.style.display === 'none') {
            apiHelp.style.display = 'block';
            getHelpBtn.textContent = '❌ 隐藏帮助';
        } else {
            apiHelp.style.display = 'none';
            getHelpBtn.textContent = '❓ 如何获取API密钥';
        }
    });

    // 更换API密钥
    changeApiBtn.addEventListener('click', function() {
        if (confirm('确定要更换API密钥吗？这将清除当前设置。')) {
            clearApiKey();
            showApiSetup();
        }
    });

    // 回车键保存API密钥
    apiKeyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveApiBtn.click();
        }
    });

    // 定位功能事件监听
    const currentLocationBtn = document.getElementById('use-current-location');
    const ipLocationBtn = document.getElementById('use-ip-location');

    if (currentLocationBtn) {
        currentLocationBtn.addEventListener('click', getCurrentLocation);
    }

    if (ipLocationBtn) {
        ipLocationBtn.addEventListener('click', getIPLocation);
    }

    // 搜索按钮点击事件
    const searchBtn = document.getElementById('search-btn');
    const originInput = document.getElementById('origin');
    const destinationInput = document.getElementById('destination');
    const transportMode = document.getElementById('transport-mode');

    // 景点搜索按钮事件
    const searchPOIBtn = document.getElementById('search-poi-btn');
    const clearPOIBtn = document.getElementById('clear-poi-btn');

    if (searchPOIBtn) {
        searchPOIBtn.addEventListener('click', searchNearbyPOI);
    }

    if (clearPOIBtn) {
        clearPOIBtn.addEventListener('click', clearPOIMarkers);
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            if (!AMap) {
                alert('地图API未加载，请先设置API密钥');
                showApiSetup();
                return;
            }

            const origin = originInput.value.trim();
            const destination = destinationInput.value.trim();

            if (!origin || !destination) {
                alert('请输入出发地和目的地');
                return;
            }

            // 检查是否选择了交通方式
            const selectedModes = getSelectedTransportModes();
            if (selectedModes.length === 0) {
                alert('请至少选择一种交通方式');
                return;
            }

            // 地理编码转换地址为坐标
            geocode(origin, function(error1, originCoord) {
                if (error1) {
                    alert('出发地地址解析失败: ' + error1);
                    return;
                }

                geocode(destination, function(error2, destCoord) {
                    if (error2) {
                        alert('目的地地址解析失败: ' + error2);
                        return;
                    }

                    // 规划路线
                    planRoute(originCoord, destCoord);
                });
            });
        });
    }

    // 回车键搜索
    if (destinationInput) {
        destinationInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchBtn.click();
            }
        });
    }
});

// 地图控制功能
function centerMap() {
    if (map && window.currentRoutes && window.currentRoutes.length > 0) {
        map.setFitView();
        console.log('地图已居中显示所有路线');
    } else if (map) {
        map.setCenter([116.397428, 39.90923]);
        map.setZoom(11);
        console.log('地图已重置到北京中心');
    }
}

function clearRoutes() {
    // 清除地图上的所有覆盖物
    if (map) {
        map.clearMap();
        console.log('已清除地图上的所有路线');
    }

    // 清除所有路线服务
    routeServices.forEach(service => {
        if (service && service.clear) {
            service.clear();
        }
    });
    routeServices = [];

    // 清除结果显示
    const resultsContainer = document.getElementById('results-list');
    resultsContainer.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">🗺️</div>
            <h4>路线已清除</h4>
            <p>重新设置起终点开始规划新的路线</p>
        </div>
    `;

    // 清除保存的路线数据
    window.currentRoutes = [];
}

// 切换路线详细步骤显示
function toggleRouteDetails(index) {
    const detailsDiv = document.getElementById(`route-details-${index}`);
    const stepsDiv = document.getElementById(`route-steps-${index}`);

    if (detailsDiv.style.display === 'none') {
        // 显示详细步骤
        detailsDiv.style.display = 'block';

        // 加载详细步骤
        loadRouteSteps(index, stepsDiv);
    } else {
        // 隐藏详细步骤
        detailsDiv.style.display = 'none';
    }
}

// 加载路线的详细步骤
function loadRouteSteps(index, container) {
    const route = window.currentRoutes[index];
    if (!route) return;

    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();

    // 根据路线类型获取详细步骤
    const mode = route.type.includes('驾车') ? 'driving' :
                 route.type.includes('步行') ? 'walking' :
                 route.type.includes('公交') ? 'transit' :
                 route.type.includes('骑行') ? 'riding' : 'driving';

    geocode(origin, function(error1, originCoord) {
        if (error1) {
            container.innerHTML = '<div class="error-steps">❌ 起点解析失败</div>';
            return;
        }

        geocode(destination, function(error2, destCoord) {
            if (error2) {
                container.innerHTML = '<div class="error-steps">❌ 终点解析失败</div>';
                return;
            }

            getDetailedSteps(mode, originCoord, destCoord, container);
        });
    });
}

// 获取详细的路线步骤
function getDetailedSteps(mode, origin, destination, container) {
    switch (mode) {
        case 'driving':
            AMap.plugin('AMap.Driving', function() {
                const driving = new AMap.Driving({ map: null });
                driving.search(origin, destination, function(status, result) {
                    if (status === 'complete' && result.routes && result.routes.length > 0) {
                        const steps = result.routes[0].steps;
                        displayDetailedSteps(steps, container, 'driving');
                    } else {
                        container.innerHTML = '<div class="error-steps">❌ 无法获取详细步骤</div>';
                    }
                });
            });
            break;

        case 'walking':
            AMap.plugin('AMap.Walking', function() {
                const walking = new AMap.Walking({ map: null });
                walking.search(origin, destination, function(status, result) {
                    if (status === 'complete' && result.routes && result.routes.length > 0) {
                        const steps = result.routes[0].steps;
                        displayDetailedSteps(steps, container, 'walking');
                    } else {
                        container.innerHTML = '<div class="error-steps">❌ 无法获取详细步骤</div>';
                    }
                });
            });
            break;

        case 'transit':
            AMap.plugin('AMap.Transfer', function() {
                const transfer = new AMap.Transfer({ map: null, city: '全国' });
                transfer.search(origin, destination, function(status, result) {
                    if (status === 'complete' && result.plans && result.plans.length > 0) {
                        const segments = result.plans[0].segments;
                        displayTransitSteps(segments, container);
                    } else {
                        container.innerHTML = '<div class="error-steps">❌ 无法获取详细步骤</div>';
                    }
                });
            });
            break;

        case 'riding':
            AMap.plugin('AMap.Riding', function() {
                const riding = new AMap.Riding({ map: null });
                riding.search(origin, destination, function(status, result) {
                    if (status === 'complete' && result.routes && result.routes.length > 0) {
                        const steps = result.routes[0].rides;
                        displayDetailedSteps(steps, container, 'riding');
                    } else {
                        container.innerHTML = '<div class="error-steps">❌ 无法获取详细步骤</div>';
                    }
                });
            });
            break;
    }
}

// 显示详细步骤（驾车、步行、骑行）
function displayDetailedSteps(steps, container, mode) {
    const modeIcons = {
        driving: '🚗',
        walking: '🚶',
        riding: '🚴'
    };

    const html = steps.map((step, index) => `
        <div class="step-item">
            <div class="step-number">${index + 1}</div>
            <div class="step-content">
                <div class="step-instruction">${step.instruction}</div>
                <div class="step-details">
                    <span class="step-distance">📏 ${(step.distance / 1000).toFixed(2)}公里</span>
                    <span class="step-time">⏱️ ${Math.round(step.time / 60)}分钟</span>
                    ${step.road ? `<span class="step-road">🛣️ ${step.road}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="steps-list">
            <div class="steps-summary">
                <span class="mode-icon">${modeIcons[mode]}</span>
                <span>共 ${steps.length} 个步骤</span>
            </div>
            ${html}
        </div>
    `;
}

// 显示公交详细步骤
function displayTransitSteps(segments, container) {
    const html = segments.map((segment, index) => {
        if (segment.transit_mode === 'WALK') {
            return `
                <div class="step-item transit-walk">
                    <div class="step-number">${index + 1}</div>
                    <div class="step-content">
                        <div class="step-instruction">🚶 步行 ${(segment.distance / 1000).toFixed(2)}公里</div>
                        <div class="step-details">
                            <span class="step-time">⏱️ ${Math.round(segment.time / 60)}分钟</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (segment.transit && segment.transit.length > 0) {
            const transit = segment.transit[0];
            return `
                <div class="step-item transit-ride">
                    <div class="step-number">${index + 1}</div>
                    <div class="step-content">
                        <div class="step-instruction">
                            🚌 乘坐 ${transit.name}
                            ${transit.start_stop ? `从 ${transit.start_stop}` : ''}
                            ${transit.end_stop ? ` 到 ${transit.end_stop}` : ''}
                        </div>
                        <div class="step-details">
                            <span class="step-distance">📏 ${(segment.distance / 1000).toFixed(2)}公里</span>
                            <span class="step-time">⏱️ ${Math.round(segment.time / 60)}分钟</span>
                            ${transit.via_num ? `<span class="step-stops">🚏 途径${transit.via_num}站</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
        return '';
    }).join('');

    container.innerHTML = `
        <div class="steps-list">
            <div class="steps-summary">
                <span class="mode-icon">🚌</span>
                <span>共 ${segments.length} 个换乘段</span>
            </div>
            ${html}
        </div>
    `;
}

// 存储POI标记
let poiMarkers = [];

// 缓存地理编码结果
let geocodeCache = {};

// 城市知名景点数据库
const cityAttractions = {
    '北京': {
        '旅游景点': [
            { name: '天安门广场', address: '北京市东城区天安门广场', lng: 116.397128, lat: 39.903738 },
            { name: '故宫博物院', address: '北京市东城区景山前街4号', lng: 116.397026, lat: 39.918058 },
            { name: '天坛公园', address: '北京市东城区天坛路甲1号', lng: 116.407394, lat: 39.882171 },
            { name: '颐和园', address: '北京市海淀区新建宫门路19号', lng: 116.275, lat: 39.999 },
            { name: '圆明园', address: '北京市海淀区清华西路28号', lng: 116.295, lat: 39.999 },
            { name: '八达岭长城', address: '北京市延庆区八达岭镇', lng: 116.017, lat: 40.359 },
            { name: '鸟巢(国家体育场)', address: '北京市朝阳区国家体育场南路1号', lng: 116.388, lat: 39.993 },
            { name: '水立方', address: '北京市朝阳区天辰东路11号', lng: 116.389, lat: 39.992 },
            { name: '雍和宫', address: '北京市东城区雍和宫大街12号', lng: 116.418, lat: 39.948 },
            { name: '恭王府', address: '北京市西城区柳荫街甲14号', lng: 116.384, lat: 39.937 },
            { name: '北海公园', address: '北京市西城区文津街1号', lng: 116.388, lat: 39.928 },
            { name: '景山公园', address: '北京市西城区景山西街44号', lng: 116.395, lat: 39.928 },
            { name: '什刹海', address: '北京市西城区什刹海', lng: 116.384, lat: 39.937 },
            { name: '南锣鼓巷', address: '北京市东城区南锣鼓巷', lng: 116.403, lat: 39.937 }
        ],
        '美食餐厅': [
            { name: '全聚德(前门店)', address: '北京市东城区前门大街30号', lng: 116.395, lat: 39.898 },
            { name: '东来顺(王府井店)', address: '北京市东城区王府井大街198号', lng: 116.407, lat: 39.915 },
            { name: '便宜坊(鲜鱼口店)', address: '北京市东城区鲜鱼口街87号', lng: 116.398, lat: 39.897 },
            { name: '护国寺小吃', address: '北京市西城区护国寺大街93号', lng: 116.374, lat: 39.938 },
            { name: '老北京炸酱面大王', address: '北京市东城区东四北大街107号', lng: 116.418, lat: 39.928 }
        ],
        '购物中心': [
            { name: '王府井大街', address: '北京市东城区王府井大街', lng: 116.407, lat: 39.915 },
            { name: '西单大悦城', address: '北京市西城区西单北大街131号', lng: 116.374, lat: 39.913 },
            { name: '三里屯太古里', address: '北京市朝阳区三里屯路19号', lng: 116.456, lat: 39.937 },
            { name: '国贸商城', address: '北京市朝阳区建国门外大街1号', lng: 116.458, lat: 39.908 }
        ]
    },
    '上海': {
        '旅游景点': [
            { name: '外滩', address: '上海市黄浦区中山东一路', lng: 121.490, lat: 31.240 },
            { name: '东方明珠', address: '上海市浦东新区世纪大道1号', lng: 121.506, lat: 31.240 },
            { name: '豫园', address: '上海市黄浦区福佑路168号', lng: 121.492, lat: 31.228 },
            { name: '城隍庙', address: '上海市黄浦区方浜中路249号', lng: 121.492, lat: 31.228 },
            { name: '南京路步行街', address: '上海市黄浦区南京东路', lng: 121.475, lat: 31.235 },
            { name: '新天地', address: '上海市黄浦区太仓路181弄', lng: 121.477, lat: 31.220 },
            { name: '田子坊', address: '上海市黄浦区泰康路210弄', lng: 121.466, lat: 31.210 },
            { name: '上海迪士尼乐园', address: '上海市浦东新区川沙镇黄赵路310号', lng: 121.666, lat: 31.150 }
        ],
        '美食餐厅': [
            { name: '南翔馒头店', address: '上海市黄浦区豫园路85号', lng: 121.492, lat: 31.228 },
            { name: '小杨生煎', address: '上海市黄浦区黄河路90号', lng: 121.475, lat: 31.235 },
            { name: '老正兴', address: '上海市黄浦区福佑路242号', lng: 121.492, lat: 31.228 }
        ]
    },
    '广州': {
        '旅游景点': [
            { name: '广州塔', address: '广州市海珠区阅江西路222号', lng: 113.319, lat: 23.109 },
            { name: '陈家祠', address: '广州市荔湾区中山七路恩龙里34号', lng: 113.243, lat: 23.125 },
            { name: '沙面岛', address: '广州市荔湾区沙面', lng: 113.236, lat: 23.115 },
            { name: '越秀公园', address: '广州市越秀区解放北路988号', lng: 113.267, lat: 23.135 },
            { name: '白云山', address: '广州市白云区白云大道南', lng: 113.300, lat: 23.183 }
        ]
    },
    '深圳': {
        '旅游景点': [
            { name: '世界之窗', address: '深圳市南山区深南大道9037号', lng: 113.975, lat: 22.539 },
            { name: '欢乐谷', address: '深圳市南山区侨城西街18号', lng: 113.985, lat: 22.548 },
            { name: '大梅沙海滨公园', address: '深圳市盐田区盐梅路9号', lng: 114.309, lat: 22.599 },
            { name: '莲花山公园', address: '深圳市福田区红荔路6030号', lng: 114.095, lat: 22.549 }
        ]
    },
    '杭州': {
        '旅游景点': [
            { name: '西湖', address: '杭州市西湖区西湖', lng: 120.139, lat: 30.259 },
            { name: '雷峰塔', address: '杭州市西湖区南山路15号', lng: 120.149, lat: 30.231 },
            { name: '灵隐寺', address: '杭州市西湖区灵隐路法云弄1号', lng: 120.101, lat: 30.242 },
            { name: '三潭印月', address: '杭州市西湖区西湖', lng: 120.139, lat: 30.259 },
            { name: '断桥残雪', address: '杭州市西湖区北山街', lng: 120.142, lat: 30.264 }
        ]
    },
    '南京': {
        '旅游景点': [
            { name: '中山陵', address: '南京市玄武区石象路7号', lng: 118.848, lat: 32.067 },
            { name: '明孝陵', address: '南京市玄武区石象路7号', lng: 118.848, lat: 32.067 },
            { name: '夫子庙', address: '南京市秦淮区夫子庙', lng: 118.794, lat: 32.034 },
            { name: '玄武湖', address: '南京市玄武区玄武巷1号', lng: 118.797, lat: 32.068 }
        ]
    },
    '西安': {
        '旅游景点': [
            { name: '兵马俑', address: '西安市临潼区秦始皇帝陵博物院', lng: 109.273, lat: 34.385 },
            { name: '华清宫', address: '西安市临潼区华清路38号', lng: 109.213, lat: 34.362 },
            { name: '大雁塔', address: '西安市雁塔区雁塔路', lng: 108.964, lat: 34.218 },
            { name: '古城墙', address: '西安市碑林区南大街2号', lng: 108.940, lat: 34.266 },
            { name: '钟楼', address: '西安市碑林区东大街', lng: 108.940, lat: 34.266 },
            { name: '回民街', address: '西安市莲湖区回民街', lng: 108.937, lat: 34.267 }
        ]
    },
    '成都': {
        '旅游景点': [
            { name: '宽窄巷子', address: '成都市青羊区长顺街127号', lng: 104.055, lat: 30.674 },
            { name: '锦里', address: '成都市武侯区武侯祠大街231号', lng: 104.050, lat: 30.647 },
            { name: '武侯祠', address: '成都市武侯区武侯祠大街231号', lng: 104.050, lat: 30.647 },
            { name: '杜甫草堂', address: '成都市青羊区青华路37号', lng: 104.023, lat: 30.660 },
            { name: '大熊猫繁育研究基地', address: '成都市成华区熊猫大道1375号', lng: 104.148, lat: 30.735 }
        ]
    }
};

// 独立的景点搜索功能
function searchNearbyPOI() {
    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();

    if (!origin && !destination) {
        alert('请先输入出发地或目的地');
        return;
    }

    // 获取选中的POI类型
    const selectedTypes = getSelectedPOITypes();
    if (selectedTypes.length === 0) {
        alert('请至少选择一种景点类型');
        return;
    }

    console.log('开始搜索城市知名景点:', { origin, destination, types: selectedTypes });

    // 清除之前的标记
    clearPOIMarkers();

    // 识别城市并获取景点
    const cities = [];
    if (origin) cities.push(identifyCity(origin));
    if (destination && destination !== origin) cities.push(identifyCity(destination));

    const allPOIs = [];

    cities.forEach(city => {
        if (city && cityAttractions[city]) {
            selectedTypes.forEach(type => {
                const attractions = cityAttractions[city][type.name] || [];
                attractions.forEach(attraction => {
                    allPOIs.push({
                        ...attraction,
                        type: type.name,
                        icon: type.icon,
                        city: city,
                        distance: 0 // 城市景点不需要距离
                    });
                });
            });
        }
    });

    console.log('找到的城市景点:', allPOIs);

    if (allPOIs.length > 0) {
        displayPOIOnMap(allPOIs);
        showPOIList(allPOIs, origin, destination);
        console.log(`🎉 找到 ${allPOIs.length} 个知名景点`);
    } else {
        const cityNames = cities.filter(c => c).join('、');
        if (cityNames) {
            alert(`暂未收录 ${cityNames} 的景点信息，请尝试其他城市`);
        } else {
            alert('无法识别城市，请输入具体的城市名称，如"北京"、"上海"等');
        }
    }
}

// 识别城市名称
function identifyCity(address) {
    const cityMap = {
        '北京': ['北京', '京'],
        '上海': ['上海', '沪'],
        '广州': ['广州', '穗'],
        '深圳': ['深圳', '深'],
        '杭州': ['杭州', '杭'],
        '南京': ['南京', '宁'],
        '西安': ['西安'],
        '成都': ['成都', '蓉']
    };

    for (const [city, keywords] of Object.entries(cityMap)) {
        if (keywords.some(keyword => address.includes(keyword))) {
            return city;
        }
    }

    return null;
}

// 获取选中的POI类型
function getSelectedPOITypes() {
    const types = [];
    if (document.getElementById('poi-tourist').checked) {
        types.push({
            key: '旅游景点|风景名胜|博物馆|公园|寺庙|古迹|纪念馆',
            icon: '🏛️',
            name: '旅游景点'
        });
    }
    if (document.getElementById('poi-food').checked) {
        types.push({
            key: '美食|餐厅|小吃|特色菜|老字号',
            icon: '🍜',
            name: '美食餐厅'
        });
    }
    if (document.getElementById('poi-shopping').checked) {
        types.push({
            key: '购物中心|商场|百货|奥特莱斯',
            icon: '🛍️',
            name: '购物中心'
        });
    }
    if (document.getElementById('poi-hotel').checked) {
        types.push({
            key: '酒店|宾馆|度假村|民宿',
            icon: '🏨',
            name: '酒店住宿'
        });
    }
    return types;
}

// 根据位置搜索POI
function searchPOIByLocation(location, type, locationTag) {
    return new Promise((resolve, reject) => {
        console.log(`开始为 ${location} 搜索 ${type.key}`);

        geocode(location, function(error, coord) {
            if (error) {
                console.error(`${location} 地理编码失败:`, error);
                resolve([]);
                return;
            }

            // 验证坐标有效性
            if (!coord || !coord.lng || !coord.lat ||
                isNaN(coord.lng) || isNaN(coord.lat) ||
                coord.lng === 0 || coord.lat === 0) {
                console.error(`${location} 获取到无效坐标:`, coord);
                resolve([]);
                return;
            }

            console.log(`${location} 地理编码成功:`, coord);

            AMap.plugin('AMap.PlaceSearch', function() {
                const placeSearch = new AMap.PlaceSearch({
                    pageSize: 20, // 增加搜索数量
                    pageIndex: 1,
                    city: '全国',
                    map: null
                });

                // 确保传递有效的坐标
                const validCoord = [parseFloat(coord.lng), parseFloat(coord.lat)];
                console.log(`搜索 ${location} 附近的 ${type.name}，坐标:`, validCoord);

                // 扩大搜索范围到10公里
                placeSearch.searchNearBy(type.key, validCoord, 10000, function(status, result) {
                    console.log(`${location} ${type.name} 搜索结果:`, status, result);

                    if (status === 'complete' && result.poiList && result.poiList.pois) {
                        // 过滤和排序POI
                        const filteredPois = filterAndSortPOIs(result.poiList.pois, type, location, validCoord);

                        const pois = filteredPois.map(poi => ({
                            ...poi,
                            type: type.name,
                            icon: type.icon,
                            locationTag: locationTag,
                            searchLocation: location
                        }));
                        console.log(`${location} 附近的 ${type.name}:`, pois.length, '个（已过滤）');
                        resolve(pois);
                    } else {
                        console.log(`${location} 附近未找到 ${type.name}，状态:`, status);
                        resolve([]);
                    }
                });
            });
        });
    });
}

// 过滤和排序POI，优先显示知名景点
function filterAndSortPOIs(pois, type, location, centerCoord) {
    // 知名景点关键词
    const famousKeywords = [
        // 北京知名景点
        '天安门', '故宫', '颐和园', '圆明园', '长城', '鸟巢', '水立方', '天坛', '雍和宫', '恭王府',
        '北海公园', '景山公园', '香山', '十三陵', '明十三陵', '慕田峪', '八达岭', '司马台',
        '什刹海', '南锣鼓巷', '王府井', '前门', '大栅栏', '琉璃厂', '潘家园', '798',
        '清华大学', '北京大学', '中国科学院', '国家博物馆', '首都博物馆', '军事博物馆',

        // 上海知名景点
        '外滩', '东方明珠', '豫园', '城隍庙', '南京路', '淮海路', '新天地', '田子坊',
        '朱家角', '七宝', '上海博物馆', '上海科技馆', '中华艺术宫', '上海迪士尼',

        // 广州知名景点
        '广州塔', '陈家祠', '沙面', '越秀公园', '白云山', '长隆', '珠江夜游',

        // 深圳知名景点
        '世界之窗', '欢乐谷', '大梅沙', '小梅沙', '莲花山', '深圳湾公园',

        // 杭州知名景点
        '西湖', '雷峰塔', '灵隐寺', '三潭印月', '苏堤', '白堤', '断桥', '花港观鱼',

        // 南京知名景点
        '中山陵', '明孝陵', '夫子庙', '秦淮河', '玄武湖', '紫金山',

        // 西安知名景点
        '兵马俑', '华清池', '大雁塔', '小雁塔', '古城墙', '钟楼', '鼓楼', '回民街',

        // 成都知名景点
        '宽窄巷子', '锦里', '武侯祠', '杜甫草堂', '青城山', '都江堰', '大熊猫基地',

        // 通用知名类型
        '博物馆', '纪念馆', '艺术馆', '科技馆', '图书馆', '大学', '公园', '广场', '寺庙', '教堂',
        '古镇', '古城', '古街', '步行街', '商业街', '购物中心', '奥特莱斯', '万达', '银泰', '大悦城'
    ];

    // 不知名或低质量关键词（需要过滤掉的）
    const lowQualityKeywords = [
        '故址', '遗址', '会馆', '胡同', '小区', '社区', '村', '厂', '公司', '有限公司',
        '门店', '专卖店', '维修', '服务', '中心', '站点', '停车场', '加油站',
        '银行', 'ATM', '药店', '诊所', '理发', '美容', '洗车', '快递', '物流'
    ];

    // 过滤POI
    const filteredPois = pois.filter(poi => {
        const name = poi.name || '';
        const address = poi.address || '';
        const fullText = name + address;

        // 检查是否包含低质量关键词
        const hasLowQuality = lowQualityKeywords.some(keyword =>
            fullText.includes(keyword)
        );

        if (hasLowQuality) {
            return false;
        }

        // 对于旅游景点，优先保留知名景点
        if (type.name === '旅游景点') {
            const isFamous = famousKeywords.some(keyword =>
                fullText.includes(keyword)
            );

            // 如果是知名景点，直接保留
            if (isFamous) {
                poi.priority = 10;
                return true;
            }

            // 如果包含"公园"、"博物馆"等，给中等优先级
            if (name.includes('公园') || name.includes('博物馆') ||
                name.includes('纪念馆') || name.includes('寺') ||
                name.includes('庙') || name.includes('塔') ||
                name.includes('广场') || name.includes('山') ||
                name.includes('湖') || name.includes('河')) {
                poi.priority = 5;
                return true;
            }

            // 其他的给低优先级，但距离很近的也保留
            if (poi.distance < 2000) {
                poi.priority = 1;
                return true;
            }

            return false;
        }

        // 对于其他类型，保留所有结果但设置优先级
        const isFamous = famousKeywords.some(keyword =>
            fullText.includes(keyword)
        );
        poi.priority = isFamous ? 10 : 3;
        return true;
    });

    // 排序：优先级高的在前，同优先级按距离排序
    filteredPois.sort((a, b) => {
        if (a.priority !== b.priority) {
            return b.priority - a.priority; // 优先级高的在前
        }
        return a.distance - b.distance; // 距离近的在前
    });

    // 限制返回数量
    const maxResults = type.name === '旅游景点' ? 8 : 6;
    return filteredPois.slice(0, maxResults);
}

// 在地图上显示POI标记
function displayPOIOnMap(pois) {
    if (!map) return;

    const bounds = new AMap.Bounds();
    let validPOICount = 0;

    // 首先添加出发地和目的地标记
    addOriginDestinationMarkers(bounds);

    pois.forEach((poi, index) => {
        // 验证POI坐标有效性 - 支持两种数据结构
        let lng, lat;

        if (poi.location && poi.location.lng && poi.location.lat) {
            // API搜索返回的数据结构
            lng = parseFloat(poi.location.lng);
            lat = parseFloat(poi.location.lat);
        } else if (poi.lng && poi.lat) {
            // 城市景点数据库的数据结构
            lng = parseFloat(poi.lng);
            lat = parseFloat(poi.lat);
        } else {
            console.warn('跳过无效坐标的POI:', poi.name, poi.location || 'no location');
            return;
        }

        // 再次验证解析后的坐标
        if (isNaN(lng) || isNaN(lat)) {
            console.warn('跳过解析失败的POI坐标:', poi.name, lng, lat);
            return;
        }

        try {
            const marker = new AMap.Marker({
                position: [lng, lat],
                title: poi.name,
                icon: new AMap.Icon({
                    image: getPOIIcon(poi.type),
                    size: new AMap.Size(32, 32),
                    imageSize: new AMap.Size(32, 32)
                }),
                offset: new AMap.Pixel(-16, -32)
            });

            // 添加点击事件
            marker.on('click', function() {
                showPOIRouteOptions(poi);
            });

            map.add(marker);
            poiMarkers.push(marker);
            bounds.extend([lng, lat]);
            validPOICount++;

            console.log(`添加POI标记: ${poi.name} at [${lng}, ${lat}]`);
        } catch (error) {
            console.error('创建POI标记失败:', poi.name, error);
        }
    });

    // 调整地图视野以显示所有POI
    if (validPOICount > 0) {
        try {
            map.setFitView();
        } catch (error) {
            console.error('设置地图边界失败:', error);
            // 备用方案：使用第一个有效POI的位置
            const firstValidPOI = pois.find(poi =>
                (poi.location && !isNaN(poi.location.lng) && !isNaN(poi.location.lat)) ||
                (poi.lng && !isNaN(poi.lng) && poi.lat && !isNaN(poi.lat))
            );
            if (firstValidPOI) {
                const lng = firstValidPOI.lng || firstValidPOI.location.lng;
                const lat = firstValidPOI.lat || firstValidPOI.location.lat;
                map.setCenter([lng, lat]);
                map.setZoom(12);
            }
        }
    }

    console.log(`在地图上显示了 ${validPOICount}/${pois.length} 个POI标记`);
}

// 添加出发地和目的地标记
function addOriginDestinationMarkers(bounds) {
    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();

    // 添加出发地标记
    if (origin) {
        geocode(origin, function(error, coord) {
            if (!error && coord) {
                const originMarker = new AMap.Marker({
                    position: [coord.lng, coord.lat],
                    title: `出发地: ${origin}`,
                    icon: new AMap.Icon({
                        image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM1MmM0MWEiLz4KPHN2ZyB4PSIxMCIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDIwIDIwIiBmaWxsPSJ3aGl0ZSI+CjxwYXRoIGQ9Ik0xMCAyQzYuMTMgMiAzIDUuMTMgMyAxMGMwIDUuMjUgNyAxMyA3IDEzcy03LTcuNzUtNy0xM2MwLTQuODcgMy4xMy04IDgtOHoiLz4KPGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMyIvPgo8L3N2Zz4KPC9zdmc+',
                        size: new AMap.Size(40, 40),
                        imageSize: new AMap.Size(40, 40)
                    }),
                    offset: new AMap.Pixel(-20, -40)
                });

                map.add(originMarker);
                poiMarkers.push(originMarker);
                bounds.extend([coord.lng, coord.lat]);

                console.log('添加出发地标记:', origin);
            }
        });
    }

    // 添加目的地标记
    if (destination && destination !== origin) {
        geocode(destination, function(error, coord) {
            if (!error && coord) {
                const destMarker = new AMap.Marker({
                    position: [coord.lng, coord.lat],
                    title: `目的地: ${destination}`,
                    icon: new AMap.Icon({
                        image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNmZjRkNGYiLz4KPHN2ZyB4PSIxMCIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDIwIDIwIiBmaWxsPSJ3aGl0ZSI+CjxwYXRoIGQ9Ik0xMCAyQzYuMTMgMiAzIDUuMTMgMyAxMGMwIDUuMjUgNyAxMyA3IDEzcy03LTcuNzUtNy0xM2MwLTQuODcgMy4xMy04IDgtOHoiLz4KPGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMyIvPgo8L3N2Zz4KPC9zdmc+',
                        size: new AMap.Size(40, 40),
                        imageSize: new AMap.Size(40, 40)
                    }),
                    offset: new AMap.Pixel(-20, -40)
                });

                map.add(destMarker);
                poiMarkers.push(destMarker);
                bounds.extend([coord.lng, coord.lat]);

                console.log('添加目的地标记:', destination);
            }
        });
    }
}

// 获取POI图标
function getPOIIcon(type) {
    const icons = {
        '旅游景点': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiNmZjRkNGYiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0id2hpdGUiPgo8cGF0aCBkPSJNOCAwQzMuNTggMCAwIDMuNTggMCA4czMuNTggOCA4IDggOC0zLjU4IDgtOFMxMi40MiAwIDggMHptMCAxNGMtMy4zMSAwLTYtMi42OS02LTZzMi42OS02IDYtNiA2IDIuNjkgNiA2LTIuNjkgNi02IDZ6Ii8+CjxwYXRoIGQ9Ik04IDRjLTIuMjEgMC00IDEuNzktNCA0czEuNzkgNCA0IDQgNC0xLjc5IDQtNC0xLjc5LTQtNC00eiIvPgo8L3N2Zz4KPC9zdmc+',
        '美食': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiNmZjk1MDAiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0id2hpdGUiPgo8cGF0aCBkPSJNOCAwQzMuNTggMCAwIDMuNTggMCA4czMuNTggOCA4IDggOC0zLjU4IDgtOFMxMi40MiAwIDggMHptMCAxNGMtMy4zMSAwLTYtMi42OS02LTZzMi42OS02IDYtNiA2IDIuNjkgNiA2LTIuNjkgNi02IDZ6Ii8+CjxwYXRoIGQ9Ik04IDRjLTIuMjEgMC00IDEuNzktNCA0czEuNzkgNCA0IDQgNC0xLjc5IDQtNC0xLjc5LTQtNC00eiIvPgo8L3N2Zz4KPC9zdmc+',
        '购物': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM5YzI3YjAiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0id2hpdGUiPgo8cGF0aCBkPSJNOCAwQzMuNTggMCAwIDMuNTggMCA4czMuNTggOCA4IDggOC0zLjU4IDgtOFMxMi40MiAwIDggMHptMCAxNGMtMy4zMSAwLTYtMi42OS02LTZzMi42OS02IDYtNiA2IDIuNjkgNiA2LTIuNjkgNi02IDZ6Ii8+CjxwYXRoIGQ9Ik04IDRjLTIuMjEgMC00IDEuNzktNCA0czEuNzkgNCA0IDQgNC0xLjc5IDQtNC0xLjc5LTQtNC00eiIvPgo8L3N2Zz4KPC9zdmc+',
        '酒店': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMwMGJjZDQiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0id2hpdGUiPgo8cGF0aCBkPSJNOCAwQzMuNTggMCAwIDMuNTggMCA4czMuNTggOCA4IDggOC0zLjU4IDgtOFMxMi40MiAwIDggMHptMCAxNGMtMy4zMSAwLTYtMi42OS02LTZzMi42OS02IDYtNiA2IDIuNjkgNiA2LTIuNjkgNi02IDZ6Ii8+CjxwYXRoIGQ9Ik04IDRjLTIuMjEgMC00IDEuNzktNCA0czEuNzkgNCA0IDQgNC0xLjc5IDQtNC0xLjc5LTQtNC00eiIvPgo8L3N2Zz4KPC9zdmc+'
    };

    return icons[type] || icons['旅游景点'];
}

// 显示POI详细信息
function showPOIInfo(poi) {
    // 获取坐标 - 支持两种数据结构
    let lng, lat;
    if (poi.location && poi.location.lng && poi.location.lat) {
        lng = poi.location.lng;
        lat = poi.location.lat;
    } else if (poi.lng && poi.lat) {
        lng = poi.lng;
        lat = poi.lat;
    } else {
        console.error('POI坐标信息缺失:', poi);
        return;
    }

    // 构建信息窗口内容
    let content = `
        <div style="padding: 15px; min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: #333;">${poi.icon || '📍'} ${poi.name}</h4>
            <p style="margin: 0 0 5px 0; color: #666; font-size: 12px;">${poi.address || poi.pname || '地址信息不详'}</p>
    `;

    // 如果有距离信息，显示距离
    if (poi.distance !== undefined && poi.searchLocation) {
        content += `<p style="margin: 0 0 5px 0; color: #999; font-size: 11px;">📍 距离 ${poi.searchLocation} 约 ${poi.distance}米</p>`;
    }

    // 如果有城市信息，显示城市
    if (poi.city) {
        content += `<p style="margin: 0 0 5px 0; color: #999; font-size: 11px;">🏙️ ${poi.city}市知名景点</p>`;
    }

    content += `
            <p style="margin: 0; color: #999; font-size: 11px;">类型: ${poi.type}</p>
        </div>
    `;

    const infoWindow = new AMap.InfoWindow({
        content: content,
        offset: new AMap.Pixel(0, -32)
    });

    infoWindow.open(map, [lng, lat]);
}

// 显示景点路线选项
function showPOIRouteOptions(poi) {
    // 获取坐标
    let lng, lat;
    if (poi.location && poi.location.lng && poi.location.lat) {
        lng = poi.location.lng;
        lat = poi.location.lat;
    } else if (poi.lng && poi.lat) {
        lng = poi.lng;
        lat = poi.lat;
    } else {
        console.error('POI坐标信息缺失:', poi);
        return;
    }

    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();

    // 构建信息窗口内容
    let content = `
        <div style="padding: 15px; min-width: 250px;">
            <h4 style="margin: 0 0 12px 0; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 8px;">
                ${poi.icon || '📍'} ${poi.name}
            </h4>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 12px;">${poi.address || '地址信息不详'}</p>
    `;

    if (poi.city) {
        content += `<p style="margin: 0 0 12px 0; color: #999; font-size: 11px;">🏙️ ${poi.city}市知名景点</p>`;
    }

    // 添加路线规划按钮
    content += `<div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 12px;">`;

    if (origin) {
        content += `
            <button onclick="planRouteToPOI('${origin}', '${poi.name}', ${lng}, ${lat})"
                    style="width: 100%; margin-bottom: 8px; padding: 8px 12px; background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
                           color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold;">
                🚗 从 ${origin.length > 10 ? origin.substring(0, 10) + '...' : origin} 到这里
            </button>
        `;
    }

    if (destination && destination !== origin) {
        content += `
            <button onclick="planRouteToPOI('${poi.name}', '${destination}', ${lng}, ${lat})"
                    style="width: 100%; margin-bottom: 8px; padding: 8px 12px; background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
                           color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold;">
                🚗 从这里到 ${destination.length > 10 ? destination.substring(0, 10) + '...' : destination}
            </button>
        `;
    }

    content += `
        <button onclick="showPOIInfo_simple('${poi.name}', '${poi.address || ''}', '${poi.type}', ${lng}, ${lat})"
                style="width: 100%; padding: 6px 12px; background: #f0f0f0; color: #666; border: 1px solid #ddd;
                       border-radius: 6px; cursor: pointer; font-size: 11px;">
            📋 仅查看详情
        </button>
    `;

    content += `</div></div>`;

    const infoWindow = new AMap.InfoWindow({
        content: content,
        offset: new AMap.Pixel(0, -32)
    });

    infoWindow.open(map, [lng, lat]);
}

// 规划到景点的路线
function planRouteToPOI(fromLocation, toLocation, toLng, toLat) {
    console.log('规划路线:', fromLocation, '→', toLocation);

    // 清除之前的路线
    clearRoutes();

    // 显示加载状态
    displayLoadingRouteInfo(fromLocation, toLocation);

    // 地理编码起点
    geocode(fromLocation, function(error, fromCoord) {
        if (error) {
            console.error('起点地址解析失败:', error);

            // 尝试使用简化地址
            const simplifiedAddress = simplifyAddress(fromLocation);
            if (simplifiedAddress !== fromLocation) {
                console.log('尝试简化地址:', simplifiedAddress);
                geocode(simplifiedAddress, function(error2, fromCoord2) {
                    if (error2) {
                        displayRouteError('起点地址解析失败，请尝试更简单的地址描述');
                        return;
                    }
                    planRouteWithCoords(fromCoord2, { lng: toLng, lat: toLat }, fromLocation, toLocation);
                });
            } else {
                displayRouteError('起点地址解析失败，请尝试更简单的地址描述');
            }
            return;
        }

        // 使用目标坐标作为终点
        const toCoord = { lng: toLng, lat: toLat };
        planRouteWithCoords(fromCoord, toCoord, fromLocation, toLocation);
    });
}

// 简化地址
function simplifyAddress(address) {
    // 提取主要地标或区域名称
    const patterns = [
        /(.+?)(酒店|宾馆|饭店)/,
        /(.+?)(医院|诊所)/,
        /(.+?)(学校|大学|学院)/,
        /(.+?)(商场|购物中心|广场)/,
        /(北京|上海|广州|深圳|杭州|南京|西安|成都)(.+?)(区|县)/
    ];

    for (const pattern of patterns) {
        const match = address.match(pattern);
        if (match) {
            if (match[3]) {
                return match[1] + match[3]; // 城市+区
            } else {
                return match[1]; // 主要地标
            }
        }
    }

    // 如果没有匹配，返回前几个字符
    return address.substring(0, Math.min(6, address.length));
}

// 使用坐标规划路线
function planRouteWithCoords(fromCoord, toCoord, fromLocation, toLocation) {
    console.log('开始规划路线，坐标:', fromCoord, '→', toCoord);

    // 验证坐标有效性
    if (!fromCoord || !fromCoord.lng || !fromCoord.lat ||
        !toCoord || !toCoord.lng || !toCoord.lat) {
        console.error('坐标无效:', fromCoord, toCoord);
        displayRouteError('坐标信息无效，无法规划路线');
        return;
    }

    // 转换为数组格式
    const fromPoint = [parseFloat(fromCoord.lng), parseFloat(fromCoord.lat)];
    const toPoint = [parseFloat(toCoord.lng), parseFloat(toCoord.lat)];

    console.log('转换后的坐标点:', fromPoint, '→', toPoint);

    // 规划驾车路线
    AMap.plugin('AMap.Driving', function() {
        const driving = new AMap.Driving({
            map: map,
            hideMarkers: false,
            autoFitView: true,
            showTraffic: true
        });

        driving.search(fromPoint, toPoint, function(status, result) {
            console.log('路线规划结果:', status, result);

            if (status === 'complete' && result.routes && result.routes.length > 0) {
                const route = result.routes[0];
                console.log('路线规划成功:', route);

                // 在右侧显示路线信息
                displaySingleRouteInfo({
                    from: fromLocation,
                    to: toLocation,
                    time: Math.round(route.time / 60),
                    distance: (route.distance / 1000).toFixed(1),
                    tolls: route.tolls || 0,
                    steps: route.steps
                });
            } else {
                console.error('路线规划失败:', status, result);
                let errorMsg = '路线规划失败';
                if (result && result.info) {
                    errorMsg += ': ' + result.info;
                }
                displayRouteError(errorMsg);
            }
        });
    });
}

// 显示单条路线信息
function displaySingleRouteInfo(routeInfo) {
    const resultsContainer = document.getElementById('results-list');

    const html = `
        <div class="route-tips">
            <span class="tips-icon">🗺️</span>
            <span class="tips-text">景点路线规划结果</span>
        </div>
        <div class="route-item" style="border-left-color: #52c41a;">
            <div class="route-header">
                <span class="transport-type">🚗 驾车路线</span>
                <span class="route-time">${routeInfo.time}分钟</span>
            </div>
            <div class="route-info">
                <div class="route-distance">距离: ${routeInfo.distance}公里</div>
                ${routeInfo.tolls > 0 ? `<div class="route-cost">费用: ¥${routeInfo.tolls}</div>` : ''}
                <div style="margin-top: 8px; font-size: 12px; color: #333; font-weight: bold;">
                    📍 ${routeInfo.from} → ${routeInfo.to}
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: #666;">
                    ${routeInfo.steps ? routeInfo.steps.slice(0, 3).map(step => step.instruction).join(' → ') : ''}
                </div>
            </div>
        </div>
    `;

    resultsContainer.innerHTML = html;
}

// 显示路线加载状态
function displayLoadingRouteInfo(from, to) {
    const resultsContainer = document.getElementById('results-list');

    const html = `
        <div class="route-tips">
            <span class="tips-icon">🔄</span>
            <span class="tips-text">正在规划路线...</span>
        </div>
        <div class="route-item" style="border-left-color: #1890ff;">
            <div class="route-header">
                <span class="transport-type">🚗 驾车路线</span>
                <span class="route-time">规划中...</span>
            </div>
            <div class="route-info">
                <div style="margin-top: 8px; font-size: 12px; color: #333; font-weight: bold;">
                    📍 ${from} → ${to}
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: #666;">
                    🔄 正在解析地址和规划最佳路线...
                </div>
            </div>
        </div>
    `;

    resultsContainer.innerHTML = html;
}

// 显示路线错误
function displayRouteError(errorMessage) {
    const resultsContainer = document.getElementById('results-list');

    const html = `
        <div class="route-tips">
            <span class="tips-icon">❌</span>
            <span class="tips-text">路线规划失败</span>
        </div>
        <div class="route-item" style="border-left-color: #ff4d4f;">
            <div class="route-header">
                <span class="transport-type">❌ 规划失败</span>
                <span class="route-time">--</span>
            </div>
            <div class="route-info">
                <div style="margin-top: 8px; font-size: 12px; color: #ff4d4f; font-weight: bold;">
                    ${errorMessage}
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: #666;">
                    💡 建议：尝试输入更简单的地址，如"北京站"、"天安门"等
                </div>
            </div>
        </div>
    `;

    resultsContainer.innerHTML = html;
}

// 简单的POI信息显示
function showPOIInfo_simple(name, address, type, lng, lat) {
    const content = `
        <div style="padding: 15px; min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: #333;">📍 ${name}</h4>
            <p style="margin: 0 0 5px 0; color: #666; font-size: 12px;">${address}</p>
            <p style="margin: 0; color: #999; font-size: 11px;">类型: ${type}</p>
        </div>
    `;

    const infoWindow = new AMap.InfoWindow({
        content: content,
        offset: new AMap.Pixel(0, -32)
    });

    infoWindow.open(map, [lng, lat]);
}

// 在右侧面板显示POI列表
function showPOIList(pois, origin, destination) {
    // 这里可以在右侧面板显示POI列表，暂时用控制台输出
    console.log('POI列表:', pois);

    // 按类型分组
    const groupedPOIs = {};
    pois.forEach(poi => {
        if (!groupedPOIs[poi.type]) {
            groupedPOIs[poi.type] = [];
        }
        groupedPOIs[poi.type].push(poi);
    });

    console.log('按类型分组的POI:', groupedPOIs);
}

// 清除POI标记
function clearPOIMarkers() {
    if (map && poiMarkers.length > 0) {
        poiMarkers.forEach(marker => {
            map.remove(marker);
        });
        poiMarkers = [];
        console.log('已清除所有POI标记');
    }
}

// 加载附近景点
function loadNearbyPOI(index, container) {
    const route = window.currentRoutes[index];
    if (!route) return;

    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();

    // 搜索起点和终点附近的景点
    Promise.all([
        searchPOI(origin, '旅游景点'),
        searchPOI(destination, '旅游景点'),
        searchPOI(origin, '美食'),
        searchPOI(destination, '美食')
    ]).then(results => {
        const [originTourist, destTourist, originFood, destFood] = results;
        displayPOIResults(container, {
            originTourist,
            destTourist,
            originFood,
            destFood
        }, origin, destination);
    }).catch(error => {
        container.innerHTML = '<div class="error-poi">❌ 景点搜索失败</div>';
    });
}

// 搜索POI
function searchPOI(location, category) {
    return new Promise((resolve, reject) => {
        geocode(location, function(error, coord) {
            if (error) {
                reject(error);
                return;
            }

            AMap.plugin('AMap.PlaceSearch', function() {
                const placeSearch = new AMap.PlaceSearch({
                    pageSize: 5,
                    pageIndex: 1,
                    city: '全国',
                    map: null
                });

                placeSearch.searchNearBy(category, coord, 2000, function(status, result) {
                    if (status === 'complete' && result.poiList && result.poiList.pois) {
                        resolve(result.poiList.pois);
                    } else {
                        resolve([]);
                    }
                });
            });
        });
    });
}

// 显示POI搜索结果
function displayPOIResults(container, results, origin, destination) {
    const { originTourist, destTourist, originFood, destFood } = results;

    const html = `
        <div class="poi-sections">
            ${originTourist.length > 0 ? `
                <div class="poi-section">
                    <h4 class="poi-section-title">🏛️ ${origin} 附近景点</h4>
                    ${originTourist.map(poi => `
                        <div class="poi-item" onclick="showPOIOnMap('${poi.location.lng}', '${poi.location.lat}', '${poi.name}')">
                            <div class="poi-name">${poi.name}</div>
                            <div class="poi-address">${poi.address || poi.pname}</div>
                            <div class="poi-distance">📍 距离约 ${poi.distance}米</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${destTourist.length > 0 ? `
                <div class="poi-section">
                    <h4 class="poi-section-title">🏛️ ${destination} 附近景点</h4>
                    ${destTourist.map(poi => `
                        <div class="poi-item" onclick="showPOIOnMap('${poi.location.lng}', '${poi.location.lat}', '${poi.name}')">
                            <div class="poi-name">${poi.name}</div>
                            <div class="poi-address">${poi.address || poi.pname}</div>
                            <div class="poi-distance">📍 距离约 ${poi.distance}米</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${originFood.length > 0 ? `
                <div class="poi-section">
                    <h4 class="poi-section-title">🍜 ${origin} 附近美食</h4>
                    ${originFood.slice(0, 3).map(poi => `
                        <div class="poi-item" onclick="showPOIOnMap('${poi.location.lng}', '${poi.location.lat}', '${poi.name}')">
                            <div class="poi-name">${poi.name}</div>
                            <div class="poi-address">${poi.address || poi.pname}</div>
                            <div class="poi-distance">📍 距离约 ${poi.distance}米</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${destFood.length > 0 ? `
                <div class="poi-section">
                    <h4 class="poi-section-title">🍜 ${destination} 附近美食</h4>
                    ${destFood.slice(0, 3).map(poi => `
                        <div class="poi-item" onclick="showPOIOnMap('${poi.location.lng}', '${poi.location.lat}', '${poi.name}')">
                            <div class="poi-name">${poi.name}</div>
                            <div class="poi-address">${poi.address || poi.pname}</div>
                            <div class="poi-distance">📍 距离约 ${poi.distance}米</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;

    container.innerHTML = html;
}

// 在地图上显示POI
function showPOIOnMap(lng, lat, name) {
    if (map) {
        // 清除之前的POI标记
        map.remove(map.getAllOverlays('marker').filter(marker => marker.getTitle && marker.getTitle().includes('POI:')));

        // 添加POI标记
        const marker = new AMap.Marker({
            position: [lng, lat],
            title: `POI: ${name}`,
            icon: new AMap.Icon({
                image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png',
                size: new AMap.Size(19, 31),
                imageSize: new AMap.Size(19, 31)
            })
        });

        map.add(marker);
        map.setCenter([lng, lat]);
        map.setZoom(16);

        // 显示信息窗口
        const infoWindow = new AMap.InfoWindow({
            content: `<div style="padding: 10px;"><h4>${name}</h4><p>点击查看详情</p></div>`,
            offset: new AMap.Pixel(0, -31)
        });

        infoWindow.open(map, [lng, lat]);

        console.log('在地图上显示POI:', name, lng, lat);
    }
}

// 自动补全功能
let autocompleteTimeout = null;
let currentSuggestions = [];
let selectedSuggestionIndex = -1;

// 初始化自动补全
function initAutocomplete() {
    const originInput = document.getElementById('origin');
    const destinationInput = document.getElementById('destination');

    if (originInput) {
        setupAutocomplete(originInput, 'origin-suggestions');
    }

    if (destinationInput) {
        setupAutocomplete(destinationInput, 'destination-suggestions');
    }
}

// 设置单个输入框的自动补全
function setupAutocomplete(input, suggestionsId) {
    const suggestionsDiv = document.getElementById(suggestionsId);

    input.addEventListener('input', function() {
        const query = this.value.trim();

        if (query.length < 2) {
            hideSuggestions(suggestionsDiv);
            return;
        }

        // 防抖处理
        clearTimeout(autocompleteTimeout);
        autocompleteTimeout = setTimeout(() => {
            searchSuggestions(query, suggestionsDiv, input);
        }, 300);
    });

    input.addEventListener('keydown', function(e) {
        handleKeyNavigation(e, suggestionsDiv, input);
    });

    input.addEventListener('blur', function() {
        // 延迟隐藏，允许点击建议项
        setTimeout(() => {
            hideSuggestions(suggestionsDiv);
        }, 200);
    });

    input.addEventListener('focus', function() {
        if (currentSuggestions.length > 0 && this.value.trim().length >= 2) {
            showSuggestions(suggestionsDiv);
        }
    });
}

// 搜索地址建议
function searchSuggestions(query, suggestionsDiv, input) {
    if (!AMap) return;

    AMap.plugin('AMap.AutoComplete', function() {
        const autoComplete = new AMap.AutoComplete({
            city: '全国',
            datatype: 'all'
        });

        autoComplete.search(query, function(status, result) {
            if (status === 'complete' && result.tips) {
                currentSuggestions = result.tips.filter(tip => tip.name && tip.district);
                displaySuggestions(currentSuggestions, suggestionsDiv, input);
            } else {
                hideSuggestions(suggestionsDiv);
            }
        });
    });
}

// 显示建议列表
function displaySuggestions(suggestions, suggestionsDiv, input) {
    if (suggestions.length === 0) {
        hideSuggestions(suggestionsDiv);
        return;
    }

    const html = suggestions.map((suggestion, index) => `
        <div class="suggestion-item" data-index="${index}" onclick="selectSuggestion(${index}, '${input.id}')">
            <div class="suggestion-icon">${getSuggestionIcon(suggestion)}</div>
            <div class="suggestion-content">
                <div class="suggestion-name">${suggestion.name}</div>
                <div class="suggestion-address">${suggestion.district || ''}${suggestion.address || ''}</div>
            </div>
        </div>
    `).join('');

    suggestionsDiv.innerHTML = html;
    showSuggestions(suggestionsDiv);
    selectedSuggestionIndex = -1;
}

// 获取建议项图标
function getSuggestionIcon(suggestion) {
    if (suggestion.typecode) {
        // 根据类型码返回不同图标
        if (suggestion.typecode.startsWith('010')) return '🏢'; // 企业
        if (suggestion.typecode.startsWith('020')) return '🏛️'; // 政府机构
        if (suggestion.typecode.startsWith('050')) return '🏥'; // 医疗
        if (suggestion.typecode.startsWith('060')) return '🏫'; // 教育
        if (suggestion.typecode.startsWith('070')) return '🏨'; // 住宿
        if (suggestion.typecode.startsWith('080')) return '🍜'; // 餐饮
        if (suggestion.typecode.startsWith('090')) return '🛍️'; // 购物
        if (suggestion.typecode.startsWith('110')) return '🚇'; // 交通
        if (suggestion.typecode.startsWith('120')) return '🏛️'; // 旅游
        if (suggestion.typecode.startsWith('130')) return '🏦'; // 金融
        if (suggestion.typecode.startsWith('140')) return '🏢'; // 商务
        if (suggestion.typecode.startsWith('150')) return '🏠'; // 住宅
        if (suggestion.typecode.startsWith('160')) return '🌳'; // 地名
    }
    return '📍'; // 默认图标
}

// 显示建议框
function showSuggestions(suggestionsDiv) {
    suggestionsDiv.classList.add('show');
}

// 隐藏建议框
function hideSuggestions(suggestionsDiv) {
    suggestionsDiv.classList.remove('show');
    selectedSuggestionIndex = -1;
}

// 处理键盘导航
function handleKeyNavigation(e, suggestionsDiv, input) {
    const suggestions = suggestionsDiv.querySelectorAll('.suggestion-item');

    if (suggestions.length === 0) return;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
            updateSuggestionHighlight(suggestions);
            break;

        case 'ArrowUp':
            e.preventDefault();
            selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
            updateSuggestionHighlight(suggestions);
            break;

        case 'Enter':
            e.preventDefault();
            if (selectedSuggestionIndex >= 0) {
                selectSuggestion(selectedSuggestionIndex, input.id);
            }
            break;

        case 'Escape':
            hideSuggestions(suggestionsDiv);
            break;
    }
}

// 更新建议项高亮
function updateSuggestionHighlight(suggestions) {
    suggestions.forEach((item, index) => {
        if (index === selectedSuggestionIndex) {
            item.classList.add('highlighted');
        } else {
            item.classList.remove('highlighted');
        }
    });
}

// 选择建议项
function selectSuggestion(index, inputId) {
    if (index >= 0 && index < currentSuggestions.length) {
        const suggestion = currentSuggestions[index];
        const input = document.getElementById(inputId);
        const suggestionsDiv = document.getElementById(inputId + '-suggestions');

        // 设置输入框值
        input.value = suggestion.name + (suggestion.district ? ' ' + suggestion.district : '');

        // 隐藏建议框
        hideSuggestions(suggestionsDiv);

        console.log('选择了建议:', suggestion);
    }
}

// 清除缓存功能
function clearCache() {
    if (confirm('确定要清除缓存吗？这将刷新页面并清除所有缓存数据。')) {
        try {
            // 清除各种缓存
            if ('caches' in window) {
                caches.keys().then(function(names) {
                    names.forEach(function(name) {
                        caches.delete(name);
                    });
                });
            }

            // 清除本地存储
            if (typeof(Storage) !== "undefined") {
                localStorage.clear();
                sessionStorage.clear();
            }

            // 清除所有cookie
            document.cookie.split(";").forEach(function(c) {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });

            // 显示成功消息
            alert('✅ 缓存已清除！页面将重新加载。');

            // 强制重新加载页面（绕过缓存）
            window.location.reload(true);

        } catch (error) {
            console.error('清除缓存时出错:', error);
            alert('⚠️ 部分缓存可能未清除，请手动刷新页面 (Ctrl+F5)');
        }
    }
}
