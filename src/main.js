//Global Config
var WRConfig = {
	
	//debug toggles
	playSound:true,
	playMusic:true,
	hitDetect:true,
	showDebug:true,
	debugMode:false,  // 添加调试模式配置

	//const dimensions
	FLOOR_WIDTH: 3600, 	// size of floor in x direction
	FLOOR_DEPTH: 7200, 	//size of floor in z direction
	MOVE_STEP: 500 		//z distance to move before recreating a new floor strip

};

// Define socket as a global variable
var socket;

// Define playerId as a global variable
var playerId;

var WRMain = function() {

	var camera, scene, renderer;

	//FX
	var composer;
	var superPass;
	var hueTime = 0;
	var fxParams = {
		vignetteAmount:0.8,
		brightness:0,
		saturation: 0.5,
	};


	var hiScore = 0;
	var score = 0;
	var distance = 0;
	var total = 0
	var sndPickup;
	var sndCollide;
	var sndMusic;
	
	var lastEvent;
	var stats;
	var splashSize;
	
	var bkgndColor = 0x061837;
	var isMobile = false;

	var splashMode = 0; //0->2 indicating which splash page is showing
	var isFirstGame = true;

	// 初始化里程显示
	$("#container").append('<div id="distance-text">0m</div>');
	$("#distance-text").css({
		'position': 'absolute',
		'top': '120px',
		'color': '#FFFFFF',
		'width': '100%',
		'text-align': 'center',
		'margin': '0 auto',
		'left': '0',
		'right': '0',
		'opacity': '0',
		'font-size': '10vmin',
		'letter-spacing': '1px',
		'display': 'flex',
		'justify-content': 'center',
		'align-items': 'center'
	});

	// 在初始化时创建一个用于显示分数的容器
	$("#container").append('<div id="score-board" style="position: absolute; top: 10px; right: 10px; color: #FFFFFF; text-align: right;"></div>');

	// // 调整初始界面样式
	// $("#splash").css({
	// 	'position': 'absolute',
	// 	'top': '50%',
	// 	'left': '50%',
	// 	'transform': 'translate(-50%, -50%)',
	// 	'text-align': 'center',
	// 	'display': 'flex',
	// 	'flex-direction': 'column',
	// 	'justify-content': 'center',
	// 	'align-items': 'center'
	// });

	// $("#info").css({
	// 	'position': 'absolute',
	// 	'bottom': '20px',
	// 	'left': '50%',
	// 	'transform': 'translateX(-50%)',
	// 	'text-align': 'center',
	// 	'width': '100%'
	// });

	function init() {

		WRConfig.showDebug = window.location.href.indexOf("?dev")  > -1;

		if (WRConfig.showDebug){
			stats = new Stats();
			stats.domElement.style.position = 'absolute';
			stats.domElement.style.top = '0px';
			stats.domElement.style.left = '0px';
			$("#container").append( stats.domElement );
		}

		isMobile = !!('ontouchstart' in window); //true for android or ios, false for MS surface

		if (isMobile){
			$("#prompt-small").text("Tap to move left or right");
			$("#info").html("");  
		} else {
			$("#prompt-small").text("Use arrow keys to move left or right.\nPress space to jump");
		}

		//INIT CONTROLS
		$("#container").on( 'touchstart', onTouchStart, false );
		$("#container").on( 'touchend', onTouchEnd, false );

		$(document).on('keydown', onKeyDown, false);
		$(document).on('keyup', onKeyUp, false);
		$("#splash").on('mousedown', onMouseDown, false);
		$("#splash").on('tap', onMouseDown, false);

		// if (window.DeviceOrientationEvent) {
		// 	window.addEventListener('deviceorientation', deviceOrientationHandler, false);
		// }

		//init audio
		if (WRConfig.playSound){
			sndPickup = new Howl( {src: ["res/audio/point.mp3"]}); 
			sndCollide = new Howl({ src: ["res/audio/hit.mp3"]}); 
			sndBest = new Howl( {src: ["res/audio/best.mp3"]}); 
		}

		if (WRConfig.playMusic){
			sndMusic = new Howl( {src: ["res/audio/rouet.mp3"],loop: true}); 
			$("#music-toggle").on("click",toggleMusic);
			$("#music-toggle").on("tap",toggleMusic);
		}

		//init 3D

		var size = 800;
		camera = new THREE.PerspectiveCamera( 75, 8 / 6, 1, 10000 );
		
		// 根据调试模式设置相机位置
		if (WRConfig.debugMode) {
			camera.position.set(0, 9000, 0);  // 将相机放在更高的位置
			camera.lookAt(new THREE.Vector3(0, 0, 0));  // 让相机看向地图中心
		} else {
			camera.position.z = WRConfig.FLOOR_DEPTH/2 - 300;
		}

		scene = new THREE.Scene();
		// 只在非调试模式下添加雾效果
		if (!WRConfig.debugMode) {
			scene.fog = new THREE.Fog( bkgndColor, WRConfig.FLOOR_DEPTH/2, WRConfig.FLOOR_DEPTH );
		}

		renderer = new THREE.WebGLRenderer();
		renderer.setSize( window.innerWidth, window.innerHeight );
		renderer.setClearColor( bkgndColor, 1 );
		$("#container").append( renderer.domElement );

		//FX
		var renderPass = new THREE.RenderPass( scene, camera );		
		superPass = new THREE.ShaderPass(THREE.SuperShader);

		superPass.uniforms.vigDarkness.value = 2;
		superPass.uniforms.vigOffset.value =  fxParams.vignetteAmount;
		superPass.uniforms.saturation.value =  fxParams.saturation -1;

		composer = new THREE.EffectComposer( renderer );
		composer.addPass( renderPass );
		composer.addPass( superPass );
		superPass.renderToScreen = true;

		// 初始化时钟
		clock = new THREE.Clock();

		// 初始化游戏状态
		score = 0;
		distance = 0;
		WRGame.init();

		// 初始化动画循环
		animate();

		//fade in
		TweenMax.fromTo(fxParams , 1, {brightness: -1},{brightness:0,delay:0.5});
		TweenMax.fromTo($('#splash') , 1, {autoAlpha: 0},{autoAlpha: 1,delay:1});
		TweenMax.fromTo($('#info') , 1, {autoAlpha: 0},{autoAlpha: 1,delay:1});
		TweenMax.fromTo($('#music-toggle') , 1, {autoAlpha: 0},{autoAlpha: 1,delay:1});

		$("#preloader").css("display","none");

		//preload splash page images
		var img1 = new Image();
		img1.src = "res/img/xmas-splash.png";
		var img2 = new Image();
		img2.src = "res/img/xmas-best.png";
		var img3 = new Image();
		img3.src = "res/img/xmas-wipeout.png";


		// Initialize the WebSocket connection
		socket = new WebSocket('ws://158.182.110.94:8080');

		socket.onopen = function() {
			// 发送加入游戏的消息
			socket.send(JSON.stringify({ type: 'join' }));
		};

		socket.onmessage = function(event) {
			const data = JSON.parse(event.data);

			switch (data.type) {
				case 'joined':
					// Save playerId
					playerId = data.playerId;
					console.log('Joined as:', playerId);
					break;

				case 'updatePlayers':
					// Update player scores display
					updatePlayerScores(data.players);
					console.log('Update score', data.players);
					break;
			}
		};

	}

	// 更新玩家分数的函数
	function updatePlayerScores(players) {
		// 在右侧显示玩家的分数
		const scoreBoard = document.getElementById('score-board');
		scoreBoard.innerHTML = ''; // 清空现有分数
		var i = 1;
		for (const [id, playerData] of Object.entries(players)) {
			const scoreItem = document.createElement('div');
			// 如果是当前玩家，添加 '(you)'
			if (id === playerId) {
				scoreItem.textContent = `Player ${i}: ${playerData.score} (you)`;
			} else {
				scoreItem.textContent = `Player ${i}: ${playerData.score}`;
			}
			scoreBoard.appendChild(scoreItem);
			i += 1;
		}
	}

	function toggleMusic(){

		$(this).toggleClass("off");

		if($(this).hasClass("off")){
			sndMusic.mute();
		}else{
			sndMusic.unmute();
		}

	}

	$(window).resize(function() {
		resize();
	});

	function resize(){

		var w = window.innerWidth; 
		var h = window.innerHeight;

		//handle retina screens
		// var dpr = 1;
		// if (window.devicePixelRatio !== undefined) {
		// 	dpr = window.devicePixelRatio;
		// }

		composer.setSize(w , h );
		renderer.setSize(w, h);
		camera.aspect = w / h;

		//scale to fit and center splash
		splashSize = Math.min(w,h)*0.85;
		splashSize = Math.min(splashSize,500);

		$("#splash").css("width", splashSize + "px");
		$("#splash").css("height", splashSize+ "px");

		$("#splash").css("left",(w - splashSize)/2 + "px");
		$("#splash").css("top",(h - splashSize)/2 + "px");

		//splash page resizing
		if (splashMode === 0){
			if (isMobile){
				$('#prompt-big').css("font-size" , splashSize * 0.05 + "px");
				$('#prompt-small').css("font-size" , splashSize * 0.06 + "px");
			}else{
				$('#prompt-big').css("font-size" , splashSize * 0.06 + "px");
				$('#prompt-small').css("font-size" , splashSize * 0.04 + "px");

			}
		}else if(splashMode == 1){
			$('#prompt-big').css("font-size" , splashSize * 0.09 + "px");
		}else{
			$('#prompt-big').css("font-size" , splashSize * 0.08 + "px");
			$('#prompt-small').css("font-size" , splashSize * 0.04 + "px");
		}

	}

	function playCollide(){
		if (WRConfig.playSound) sndCollide.play();
	}

	function onScorePoint(){
		if (WRConfig.playSound) sndPickup.play();
		score += 1;
		$("#score-text").text(score);
		TweenMax.fromTo($('#score-text') , 0.4, {scale: 2},{scale: 1,ease:Bounce.easeOut});

		if (score === hiScore + 1 && hiScore !== 0){
			if (WRConfig.playSound) sndBest.play();
		}

		// Send score update message to server
		if (socket && socket.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify({ type: 'score', playerId: playerId, value: score }));
		}
	}

	function onGameOver(){

		if (WRConfig.playSound) sndCollide.play();

		//display score
		TweenMax.to($('#score-text') , 0.1, {autoAlpha: 0});
		TweenMax.to($('#distance-text') , 0.1, {autoAlpha: 0});
		TweenMax.fromTo($('#splash') , 0.5, {scale: 0.6,autoAlpha: 0},{scale: 1,autoAlpha: 1,ease:Expo.easeOut});
		TweenMax.fromTo($('#info') , 0.5, {autoAlpha: 0},{autoAlpha: 1});
		TweenMax.fromTo($('#music-toggle') , 0.5, {autoAlpha: 0},{autoAlpha: 1});

		// 设置splash容器的样式
		$('#splash').css({
			'position': 'absolute',
			'top': '50%',
			'left': '50%',
			'transform': 'translate(-50%, -50%)',
			'width': '400px',
			'height': '400px',
			'background-size': 'contain',
			'background-repeat': 'no-repeat',
			'background-position': 'center'
		});

		if (score > hiScore){
			splashMode = 1;
			hiScore = score;
			$('#splash').css('background-image', 'url(res/img/xmas-best.png)');
			$('#splash').css({
				'position': 'absolute',
				'top': '50%',
				'left': '50%',
				'transform': 'translate(-50%, -50%)',
				'width': '600px',
				'height': '600px',
				'background-size': 'contain',
				'background-repeat': 'no-repeat',
				'background-position': 'center'
			});
			$('#prompt-big').text("DISTANCE: " + Math.floor(distance) + "m\nSCORE: " + score);
			$('#prompt-small').css('display','none');
			$('#prompt-big').css({
				'position': 'absolute',
				'top': '80%',
				'left': '50%',
				'transform': 'translate(-50%, -50%)',
				'text-align': 'center',
				'width': '300px',
				'height': '150px',
				'z-index': '1',
				'white-space': 'pre-line',
				'font-size': '20px',
				'margin': '0',
				'padding': '0',
				'line-height': '2.5'
			});
		}else{
			splashMode = 2;
			$('#splash').css('background-image', 'url(res/img/xmas-wipeout.png)');
			$('#splash').css({
				'position': 'absolute',
				'top': '50%',
				'left': '50%',
				'transform': 'translate(-50%, -50%)',
				'width': '600px',
				'height': '600px',
				'background-size': 'contain',
				'background-repeat': 'no-repeat',
				'background-position': 'center'
			});
			$('#prompt-big').text("DISTANCE: " + Math.floor(distance) + "m\tSCORE: " + score + "\n");
			$('#prompt-small').text("BEST SCORE: " + hiScore);
			$('#prompt-small').css('display','block');
			$('#prompt-big').css({
				'position': 'absolute',
				'top': '80%',
				'left': '50%',
				'transform': 'translate(-50%, -50%)',
				'text-align': 'center',
				'width': '300px',
				'height': '150px',
				'z-index': '1',
				'white-space': 'pre-line',
				'font-size': '20px',
				'margin': '0',
				'padding': '0',
				'line-height': '2.5'
			});
			$('#prompt-small').css({
				'position': 'absolute',
				'top': '99%',
				'left': '50%',
				'transform': 'translate(-50%, -50%)',
				'text-align': 'center',
				'width': '300px',
				'height': '50px',
				'z-index': '1',
				'font-size': '18px',
				'margin': '0',
				'padding': '0',
				'line-height': '1.5'
			});
		 }

		// resize();
		hueTime =0;

	}

	function onGameStart(){
		TweenMax.to($('#splash') , 0.3, {autoAlpha: 0});
		TweenMax.to($('#info') , 0.3, {autoAlpha: 0});
		TweenMax.to($('#music-toggle') , 0.3, {autoAlpha: 0});
		TweenMax.to($('#score-text') , 0.3, {autoAlpha: 1,delay:0.3});
		TweenMax.to($('#distance-text') , 0.3, {autoAlpha: 1,delay:0.3});
		score = 0;
		distance = 0;
		$("#score-text").text(score);
		$("#distance-text").text("0m");
		// Send score update message to server
		if (socket && socket.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify({ type: 'score', playerId: playerId, value: score }));
		}
		if (isFirstGame && WRConfig.playMusic ) sndMusic.play();						

		WRGame.startGame(isFirstGame);
		isFirstGame = false;
	}

	function animate(){
		requestAnimationFrame( animate );
		
		// 更新游戏状态
		WRGame.animate();
		
		// 更新调试信息
		if (WRConfig.showDebug){
			stats.update();
		}

		// 更新里程
		if (WRGame.getPlaying()) {
			var delta = clock.getDelta();
			distance += WRGame.getSpeed() * delta * 10;
			$("#distance-text").text(Math.floor(distance) + "m");
		}

		// 更新视觉效果
		var hueAmount = WRGame.getSpeed() < 0.5 ? 0 : (WRGame.getSpeed() - 0.5) * 2;
		superPass.uniforms.hueAmount.value = hueAmount*0.7;

		hueTime += WRGame.getSpeed() * WRGame.getSpeed() * 0.05;
		superPass.uniforms.hue.value = hueTime % 2 - 1;
		superPass.uniforms.brightness.value = fxParams.brightness;

		// 渲染场景
		composer.render();
	}

	//INPUT HANDLERS
	function onTouchStart( event ) {

		if (!WRGame.getPlaying() && WRGame.getAcceptInput()){
			onGameStart();
		}

		for(  var i = 0; i <  event.touches.length; i++) {

			event.preventDefault();

			var xpos = event.touches[ i ].pageX;

			if (xpos > window.innerWidth / 2){
				WRGame.setRightDown(true);
			}else{
				WRGame.setLeftDown(true);
			}
		}
	}

	function onTouchEnd( event ) {

		for(  var i = 0; i <  event.changedTouches.length; i++) {

			event.preventDefault();
			var xpos = event.changedTouches[ i ].pageX;

			if (xpos > window.innerWidth / 2){
				WRGame.setRightDown(false);
			}else{
				WRGame.setLeftDown( false);
			}
		}
	}

	function onKeyUp( event ) {

		lastEvent = null;

		switch ( event.keyCode ) {
			case 39: /* RIGHT */
				WRGame.setRightDown(false);
				break;
			case 37: /* LEFT */
				WRGame.setLeftDown(false);					
				break;
		}

		//endSlide();
	}

	function onKeyDown(event) {

		if (lastEvent && lastEvent.keyCode == event.keyCode) {
			return;
		}

		lastEvent = event;

		if (!WRGame.getPlaying() && WRGame.getAcceptInput()){
			onGameStart();
		}
		
		switch ( event.keyCode ) {
			case 39: /* RIGHT */
				WRGame.setRightDown(true);
				break;
			case 37: /* LEFT */
				WRGame.setLeftDown( true);
				break;
			
		}
	}

	function onMouseDown(){

		if (!WRGame.getPlaying()){
			onGameStart();
		}
	}

	function trace(text){
		if (WRConfig.showDebug){
			$("#debug-text").text(text);
		}
	}

	// function deviceOrientationHandler(eventData) {
	// 	if (eventData.beta === null) return;
	// 	var cuttoff = 5;
	// 	var tiltedRight = eventData.beta > cuttoff;
	// 	var tiltedLeft = eventData.beta < -cuttoff;
	// 	WRGame.setRightDown(tiltedRight);
	// 	WRGame.setLeftDown(tiltedLeft);
	// }

	return {
		init:init,
		trace: trace,
		onGameOver:onGameOver,
		onScorePoint: onScorePoint,
		getScene:function (){return scene;},
		getCamera:function (){return camera;},
		playCollide:playCollide,
		fxParams:fxParams,
	};


}();

$(document).ready(function() {
	WRMain.init();
});

window.addEventListener('beforeunload', function() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'disconnect', playerId: playerId }));
    }
});
