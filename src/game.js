/**
	Winter Rush Game
	Handles track, trees, motion, hit detection
	by Felix Turner / @felixturner / www.airtight.cc
**/

var WRGame = function() {

	var ACCEL = 100;
	var MAX_SPEED_ACCEL = 50;
	var START_MAX_SPEED = 1800;
	var FINAL_MAX_SPEED = 2500;
	var SIDE_ACCEL = 500;
	var MAX_SIDE_SPEED = 4000;
	var TREE_COLS = [0x466310,0x355B4B,0x449469];
	var TREE_COUNT = 6;
	var ROCK_COUNT = 5;
	var FLOOR_RES = 20;
	var FLOOR_YPOS = -300;
	var FLOOR_THICKNESS = 300;

	// 添加跳跃相关变量
	var JUMP_FORCE = 1700;  // 跳跃力度
	var GRAVITY = -1600;    // 重力
	var isJumping = false;  // 是否在跳跃
	var verticalVelocity = 0; // 垂直速度
	var playerHeight = 0;  // 玩家高度

	var stepCount = 0;
	var moveSpeed = 0; //z distance per second
	var maxSpeed; //increments over time
	var slideSpeed = 0;
	var sliding = false;

	var rightDown = false;
	var leftDown = false;
	var playing = false;
	var acceptInput = true;
	var clock;

	var trees = [];
	var rocks = [];  // 添加石头数组
	var floorGeom, floorMaterial, floor;

	var noiseScale = 3;
	var noiseSeed = Math.random() * 100;

	var moverGroup;
	var presentGroup;
	var floorGeometry;
	var treeMaterials;
	var trunkMaterial;
	var treeGeom;
	var trunkGeom;
	var rockGeom;  // 添加石头几何体
	var rockMaterial;  // 添加石头材质
	
	var snoise = new ImprovedNoise();

	function init(){

		clock = new THREE.Clock();

		//lights
		//HemisphereLight(skyColorHex, groundColorHex, intensity)
		var hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x000000, 0.6);
		WRMain.getScene().add( hemisphereLight );
		hemisphereLight.position.y = 300;

		//middle light
		var centerLight = new THREE.PointLight( 0xFFFFFF, 0.8, 4500 );
		WRMain.getScene().add(centerLight);
		centerLight.position.z = WRConfig.FLOOR_DEPTH/4;
		centerLight.position.y = 500;

		var frontLight = new THREE.PointLight( 0xFFFFFF, 1, 2500 );
		WRMain.getScene().add(frontLight);
		frontLight.position.z = WRConfig.FLOOR_DEPTH/2;

		moverGroup = new THREE.Object3D();
		WRMain.getScene().add( moverGroup );

		//make floor
		var floorGroup = new THREE.Object3D();

		var floorMaterial = new THREE.MeshLambertMaterial({
			color: 0xCCCCCC, //diffuse							
			emissive: 0x000000, 
			shading: THREE.FlatShading, 
			side: THREE.DoubleSide,
		});

		//add extra x width
		floorGeometry = new THREE.PlaneGeometry( WRConfig.FLOOR_WIDTH + 1200, WRConfig.FLOOR_DEPTH , FLOOR_RES,FLOOR_RES );
		var floorMesh = new THREE.Mesh( floorGeometry, floorMaterial );
		floorGroup.add( floorMesh );
		moverGroup.add( floorGroup );
		floorMesh.rotation.x = Math.PI/2;
		//floorMesh.rotation.z = Math.PI/2;
		floorGroup.position.y = FLOOR_YPOS;
		moverGroup.position.z = - WRConfig.MOVE_STEP;
		floorGroup.position.z = 500;

		//make trees
		var i;
		treeMaterials = [];

		for(  i= 0; i < TREE_COLS.length; i++) {

			var treeMaterial = new THREE.MeshPhongMaterial({
				color: TREE_COLS[i],     // 基础颜色保持不变
				specular: 0x222222,      // 降低反光强度
				shininess: 10,           // 进一步降低光泽度
				emissive: 0x000000,      // 无自发光
				flatShading: true,       // 保持平面着色效果
				side: THREE.DoubleSide    // 双面渲染
			});
			treeMaterials.push(treeMaterial);
		}

		trunkMaterial = new THREE.MeshLambertMaterial({
				color: 0x330000, 					
				shading: THREE.FlatShading, 
				blending: THREE.NormalBlending, 
				depthTest: true,
				transparent: false,
				opacity: 1.0,
			});

		trunkGeom = new THREE.CylinderGeometry(50, 50, 200, 8, 1, false);
		treeGeom = new THREE.CylinderGeometry(0, 250, 1200, 8, 1, false);

		// 创建石头几何体和材质
		rockGeom = new THREE.DodecahedronGeometry(200, 1);  // 增加细节级别

		// 加载纹理
		var textureLoader = new THREE.TextureLoader();
		var rockBaseColor = textureLoader.load('models/rock/textures/Rock_01_A_baseColor.jpeg');
		var rockNormal = textureLoader.load('models/rock/textures/Rock_01_A_normal.png');
		var rockMetallicRoughness = textureLoader.load('models/rock/textures/Rock_01_A_metallicRoughness.png');

		rockMaterial = new THREE.MeshStandardMaterial({
			map: rockBaseColor,  // 基础颜色贴图
			normalMap: rockNormal,  // 法线贴图
			metalnessMap: rockMetallicRoughness,  // 金属度贴图
			roughnessMap: rockMetallicRoughness,  // 粗糙度贴图
			metalness: 0.5,  // 金属度
			roughness: 0.8,  // 粗糙度
			side: THREE.DoubleSide  // 双面渲染
		});

		// 生成树
		var minDistance = 300; // 最小安全距离
		for(i = 0; i < TREE_COUNT; i++) {
			var scl = ATUtil.randomRange(0.8,1.3);
			var matID = i%TREE_COLS.length;
			var tree = makeTree(scl,matID);
			moverGroup.add(tree);
			
			// 尝试生成新位置，直到找到合适的位置
			var attempts = 0;
			var isPositionValid = false;
			while(!isPositionValid && attempts < 10) {
				tree.posi = Math.random();
				tree.posj = Math.random();
				tree.position.x = tree.posj * WRConfig.FLOOR_WIDTH - WRConfig.FLOOR_WIDTH/2;
				tree.position.z = - (tree.posi * WRConfig.FLOOR_DEPTH) + WRConfig.FLOOR_DEPTH/2;
				
				// 检查与现有树的位置是否太近
				isPositionValid = true;
				for(var j = 0; j < trees.length; j++) {
					var dx = trees[j].position.x - tree.position.x;
					var dz = trees[j].position.z - tree.position.z;
					var distance = Math.sqrt(dx*dx + dz*dz);
					if(distance < minDistance) {
						isPositionValid = false;
						break;
					}
				}
				attempts++;
			}
			
			tree.rotation.y = Math.random()*Math.PI*2;
			trees.push(tree);
			tree.collided = false;
		}

		// 生成石头
		for(i = 0; i < ROCK_COUNT; i++) {
			var rock = makeRock(0.8 + Math.random() * 0.8);
			moverGroup.add(rock);
			
			// 尝试生成新位置，直到找到合适的位置
			var attempts = 0;
			var isPositionValid = false;
			while(!isPositionValid && attempts < 10) {
				rock.posi = Math.random() * 0.7 + 0.3;  // 修改随机范围，避免在近处生成
				rock.posj = Math.random();
				rock.position.x = rock.posj * WRConfig.FLOOR_WIDTH - WRConfig.FLOOR_WIDTH/2;
				rock.position.z = - (rock.posi * WRConfig.FLOOR_DEPTH) + WRConfig.FLOOR_DEPTH/2;
				
				// 检查与现有树和石头的位置是否太近
				isPositionValid = true;
				for(var j = 0; j < trees.length; j++) {
					var dx = trees[j].position.x - rock.position.x;
					var dz = trees[j].position.z - rock.position.z;
					var distance = Math.sqrt(dx*dx + dz*dz);
					if(distance < minDistance) {
						isPositionValid = false;
						break;
					}
				}
				
				if(isPositionValid) {
					for(var j = 0; j < rocks.length; j++) {
						var dx = rocks[j].position.x - rock.position.x;
						var dz = rocks[j].position.z - rock.position.z;
						var distance = Math.sqrt(dx*dx + dz*dz);
						if(distance < minDistance) {
							isPositionValid = false;
							break;
						}
					}
				}
				
				attempts++;
			}
			
			rock.rotation.x = Math.random() * Math.PI;
			rock.rotation.y = Math.random() * Math.PI * 2;
			rock.rotation.z = Math.random() * Math.PI;
			rocks.push(rock);
			rock.collided = false;
		}

		//add trees down the edges
		var EDGE_TREE_COUNT = 12;
		for( i = 0; i < EDGE_TREE_COUNT; i++) {
			tree = makeTree(1.3,0);
			moverGroup.add( tree );
			tree.position.x = WRConfig.FLOOR_WIDTH/2 + 300;
			tree.position.z = WRConfig.FLOOR_DEPTH * i/EDGE_TREE_COUNT -  WRConfig.FLOOR_DEPTH/2;

		}

		for( i = 0; i < EDGE_TREE_COUNT; i++) {
			tree = makeTree(1.3,0);
			moverGroup.add( tree );
			tree.position.x = -(WRConfig.FLOOR_WIDTH/2 + 300);
			tree.position.z = WRConfig.FLOOR_DEPTH * i/EDGE_TREE_COUNT -  WRConfig.FLOOR_DEPTH/2;
		}

		//add floating present
		presentGroup = new THREE.Object3D();
		moverGroup.add( presentGroup );

		presentGroup.position.x = ATUtil.randomRange(-WRConfig.FLOOR_WIDTH/2, WRConfig.FLOOR_WIDTH/2);
		presentGroup.position.z = ATUtil.randomRange(-WRConfig.FLOOR_DEPTH/2, WRConfig.FLOOR_DEPTH/2);
		//presentGroup.position.y = 200;

		var presentMaterial = new THREE.MeshPhongMaterial({
			color: 0xFF0000, 
			specular: 0x00FFFF, 
			emissive: 0x0000FF, 
			shininess: 60, 
			shading: THREE.FlatShading, 
			blending: THREE.NormalBlending, 
			depthTest: true,
			transparent: false,
			opacity: 1.0		
		});

		var presentGeom = new THREE.TetrahedronGeometry(100, 2);

		var present = new THREE.Mesh( presentGeom, presentMaterial );
		presentGroup.add( present );

		//PointLight(hex, intensity, distance)
		var presentLight = new THREE.PointLight( 0xFF00FF, 1.2, 600 );
		presentGroup.add( presentLight );

		presentGroup.collided = false;

		
		WRSnow.init();

		setFloorHeight();

		resetField();

		clock.start();
		maxSpeed = START_MAX_SPEED;

		// 添加空格键跳跃监听
		document.addEventListener('keydown', function(event) {
			if (event.code === 'Space') {
				handleJump();
			}
		});

	}

	function makeTree(scale,materialID){

		var tree = new THREE.Object3D();
		var branches = new THREE.Mesh( treeGeom, treeMaterials[materialID] );
		var trunk =   new THREE.Mesh( trunkGeom, trunkMaterial );
		tree.add( branches );
		tree.add( trunk );
		trunk.position.y =  -700;
		tree.scale.x = tree.scale.z = tree.scale.y = scale; 
		tree.myheight = 1400 * tree.scale.y;  // 恢复树的高度为1400
		//put tree on floor
		tree.position.y =  tree.myheight/2 - 300;
		return tree;
	}

	// 添加生成石头的函数
	function makeRock(scale) {
		var rock = new THREE.Mesh(rockGeom, rockMaterial);
		// 添加随机变形
		rock.geometry.vertices.forEach(function(vertex) {
			vertex.x += (Math.random() - 0.5) * 50;
			vertex.y += (Math.random() - 0.5) * 50;
			vertex.z += (Math.random() - 0.5) * 50;
		});
		rock.geometry.verticesNeedUpdate = true;
		rock.geometry.computeVertexNormals();
		
		rock.scale.x = rock.scale.z = rock.scale.y = scale;
		rock.myheight = 200 * rock.scale.y;  // 设置石头的高度
		rock.position.y = rock.myheight/2 - 250;  // 进一步降低石头的位置
		
		// 添加随机旋转
		rock.rotation.x = Math.random() * Math.PI;
		rock.rotation.y = Math.random() * Math.PI * 2;
		rock.rotation.z = Math.random() * Math.PI;
		
		return rock;
	}

	function setFloorHeight(){ 

		//apply noise to floor

		//move mover back by WRConfig.MOVE_STEP
		stepCount++;
		moverGroup.position.z = - WRConfig.MOVE_STEP;

		//calculate vert psons base on noise
		var i;
		var ipos;
		var offset = stepCount *WRConfig.MOVE_STEP/WRConfig.FLOOR_DEPTH * FLOOR_RES;

		for( i = 0; i < FLOOR_RES + 1; i++) {
			for( var j = 0; j < FLOOR_RES + 1; j++) {
				ipos = i + offset;
				floorGeometry.vertices[i * (FLOOR_RES + 1)+ j].z = snoise.noise(ipos/FLOOR_RES * noiseScale, j/FLOOR_RES * noiseScale, noiseSeed ) * FLOOR_THICKNESS;
			}
		}
		floorGeometry.verticesNeedUpdate = true;

		for(  i = 0; i < TREE_COUNT; i++) {

			var tree = trees[i];
			tree.position.z +=WRConfig.MOVE_STEP;

			if (tree.position.z + moverGroup.position.z > WRConfig.FLOOR_DEPTH/2){

				tree.collided = false;
				tree.position.z	-= WRConfig.FLOOR_DEPTH;
				ipos = tree.posi + offset/FLOOR_RES * WRConfig.FLOOR_DEPTH;
				//re-randomize x pos
				tree.posj = Math.random();
				tree.position.x = tree.posj * WRConfig.FLOOR_WIDTH - WRConfig.FLOOR_WIDTH/2;
				tree.visible = true;
			}			 

		}

		// 移动石头
		for(i = 0; i < rocks.length; i++) {
			var rock = rocks[i];
			rock.position.z += WRConfig.MOVE_STEP;

			if(rock.position.z + moverGroup.position.z > WRConfig.FLOOR_DEPTH/2) {
				rock.collided = false;
				rock.position.z -= WRConfig.FLOOR_DEPTH;
				// 重新随机位置，避免在近处生成
				rock.posi = Math.random() * 0.7 + 0.3;  // 修改随机范围
				rock.posj = Math.random();
				rock.position.x = rock.posj * WRConfig.FLOOR_WIDTH - WRConfig.FLOOR_WIDTH/2;
				rock.visible = true;
			}
		}

		WRSnow.shift();

		//shift present
		presentGroup.position.z += WRConfig.MOVE_STEP;
		if (presentGroup.position.z + moverGroup.position.z > WRConfig.FLOOR_DEPTH/2){
			presentGroup.collided = false;
			presentGroup.position.z	-= WRConfig.FLOOR_DEPTH;
			
			// 检查新位置是否与障碍物太近
			var isTooClose = true;
			var attempts = 0;
			var minDistance = 400;  // 最小安全距离
			
			while(isTooClose && attempts < 10) {
				// 重新随机位置
				presentGroup.posj = Math.random();
				var xRange = WRConfig.FLOOR_WIDTH/2 * 0.7;
				presentGroup.position.x = ATUtil.randomRange(-xRange,xRange);
				
				// 检查与所有障碍物的距离
				isTooClose = false;
				for(var i = 0; i < TREE_COUNT; i++) {
					var tree = trees[i];
					var dx = tree.position.x - presentGroup.position.x;
					var dz = tree.position.z - presentGroup.position.z;
					var distance = Math.sqrt(dx*dx + dz*dz);
					if(distance < minDistance) {
						isTooClose = true;
						break;
					}
				}
				
				if(!isTooClose) {
					for(var i = 0; i < rocks.length; i++) {
						var rock = rocks[i];
						var dx = rock.position.x - presentGroup.position.x;
						var dz = rock.position.z - presentGroup.position.z;
						var distance = Math.sqrt(dx*dx + dz*dz);
						if(distance < minDistance) {
							isTooClose = true;
							break;
						}
					}
				}
				
				attempts++;
			}
		}		

	}

	function animate() {


		var i;

		var delta = clock.getDelta();	

		//PLAYER MOVEMENT
		if (playing){
		
			//max speed accelerates slowly
			maxSpeed += delta *MAX_SPEED_ACCEL;
			maxSpeed = Math.min(maxSpeed,FINAL_MAX_SPEED);

			//move speed accelerates quickly after a collision
			moveSpeed += delta *ACCEL;
			moveSpeed = Math.min(moveSpeed,maxSpeed);

			//right takes precedence
			if (rightDown){

				slideSpeed += SIDE_ACCEL;
				slideSpeed = Math.min(slideSpeed,MAX_SIDE_SPEED);

			} else if (leftDown){

				slideSpeed -= SIDE_ACCEL;
				slideSpeed = Math.max(slideSpeed,-MAX_SIDE_SPEED);

			}else{
				slideSpeed *= 0.8;
			}

			// 在跳跃时侧滑速度减半
			if (isJumping) {
				slideSpeed *= 0.8;
			}

			//bounce off edges of rails
			var nextx = WRMain.getCamera().position.x + delta * slideSpeed;

			if (nextx > WRConfig.FLOOR_WIDTH/2 || nextx < -WRConfig.FLOOR_WIDTH/2){
				slideSpeed = -slideSpeed;
				WRMain.playCollide();
			}


			WRMain.getCamera().position.x += delta * slideSpeed;

			//TILT
			//moverGroup.rotation.z = 0.016 * slideSpeed * 0.003;
			moverGroup.rotation.z = slideSpeed * 0.000038;

			// 更新重力
			updateGravity(delta);

		}else{
			//slow down after dead
			moveSpeed *= 0.95;

		}

		presentGroup.rotation.x += 0.01;
		presentGroup.rotation.y += 0.02;

	

		moverGroup.position.z += delta * moveSpeed;

		if (moverGroup.position.z > 0){
			//build new strip
			setFloorHeight();
		}

		WRSnow.animate();
		
		//SIMPLE HIT DETECT

		if (WRConfig.hitDetect){

			var p;
			var dist;

			var camPos = WRMain.getCamera().position.clone();
			camPos.z -= 200;

			p = presentGroup.position.clone();
			p.add(moverGroup.position);
			dist = p.distanceTo(camPos);
			if (dist < 200 && !presentGroup.collided){
				//GOT POINT
				presentGroup.collided = true;
				WRMain.onScorePoint();
			}


			for(  i = 0; i < TREE_COUNT; i++) {

				p = trees[i].position.clone();
				p.add(moverGroup.position);

				//can only hit trees if they are in front of you
				if (p.z < camPos.z && p.z > camPos.z - 150){

					// 计算水平距离
					var horizontalDist = Math.sqrt(
						Math.pow(p.x - camPos.x, 2) + 
						Math.pow(p.z - camPos.z, 2)
					);

					// 计算垂直距离
					var verticalDist = Math.abs(p.y - camPos.y);

					// 根据树的缩放比例调整碰撞范围
					var collisionRange = 200 * trees[i].scale.x;  // 使用树的x轴缩放作为基础

					// 检查是否在树木的碰撞范围内 
					if (horizontalDist < collisionRange && 
						verticalDist < trees[i].myheight/2 &&  // 使用树的实际高度
						!trees[i].collided) {
						//GAME OVER
						trees[i].collided = true;
						onGameEnd();
					}		
				}
			}

			// 检查石头碰撞
			for(i = 0; i < rocks.length; i++) {
				p = rocks[i].position.clone();
				p.add(moverGroup.position);

				// 只在石头在玩家前方时检查碰撞
				if (p.z < camPos.z && p.z > camPos.z - 150) {
					// 计算水平距离
					var horizontalDist = Math.sqrt(
						Math.pow(p.x - camPos.x, 2) + 
						Math.pow(p.z - camPos.z, 2)
					);

					// 计算垂直距离
					var verticalDist = Math.abs(p.y - camPos.y);

					// 根据石头的缩放比例调整碰撞范围
					var collisionRange = 250 * rocks[i].scale.x;  // 增大碰撞范围
					var verticalCollisionRange = rocks[i].myheight * 2;  // 添加垂直碰撞范围

					// 检查是否在石头的碰撞范围内
					if (horizontalDist < collisionRange && 
						verticalDist < verticalCollisionRange &&  // 使用垂直碰撞范围
						!rocks[i].collided) {
						// 游戏结束
						rocks[i].collided = true;
						onGameEnd();
					}
				}
			}
		}

	}
	

	function startGame(isFirstGame){

		acceptInput = false;
		//if first game just start run
		if (isFirstGame){
			startRun();
			return;
		}

		//fade out
		TweenMax.fromTo(WRMain.fxParams,0.3,{brightness:0},{brightness:-1});
		TweenMax.delayedCall(0.3,resetField);
		TweenMax.fromTo(WRMain.fxParams,0.3,{brightness:-1},{brightness:0,delay:0.3});
		TweenMax.delayedCall(0.6,startRun);

	}

	function resetField(){
		
		var camPos = WRMain.getCamera().position;
		//put cam in middle
		camPos.x = 0;
		//set tilt to 0
		slideSpeed = 0;
		moverGroup.rotation.z = 0;
		
		// 重置跳跃状态
		isJumping = false;
		verticalVelocity = 0;
		moverGroup.position.y = playerHeight;

		//kill trees that are too close at the start
		for(var i = 0; i < TREE_COUNT; i++) {
			p = trees[i].position.clone();
			p.add(moverGroup.position);

			if (p.z < camPos.z && p.z > camPos.z - WRConfig.FLOOR_DEPTH/2) {
				trees[i].collided = true;
				trees[i].visible = false;
			}
		}

		//kill rocks that are too close at the start
		for(var i = 0; i < rocks.length; i++) {
			p = rocks[i].position.clone();
			p.add(moverGroup.position);

			if (p.z < camPos.z && p.z > camPos.z - WRConfig.FLOOR_DEPTH/2) {
				rocks[i].collided = true;
				rocks[i].visible = false;
			}
		}
	}

	function startRun(){
		playing = true;
		acceptInput = true;
		moveSpeed = START_MAX_SPEED * 0.3;  // 设置初始速度为最大速度的一半
	}

	function onAcceptInput(){
	 	acceptInput = true;
	}

	function onGameEnd(){
		moveSpeed = -1200;
		maxSpeed = START_MAX_SPEED;
		playing = false;
		acceptInput = false;
		//wait before re-enabling start game
		TweenMax.delayedCall(1,onAcceptInput);
		WRMain.onGameOver();
	
	}

	// 添加跳跃处理函数
	function handleJump() {
		if (!isJumping && acceptInput) {
			isJumping = true;
			verticalVelocity = JUMP_FORCE;
			playing = true;

		}
	}

	// 添加重力更新函数
	function updateGravity(delta) {
		if (isJumping) {
			verticalVelocity += GRAVITY * delta;
			moverGroup.position.y -= verticalVelocity * delta;
			
			// 检查是否落地
			if (moverGroup.position.y >= playerHeight) {
				moverGroup.position.y = playerHeight;
				isJumping = false;
				verticalVelocity = 0;
			}
		}
	}

	return {
		init:init,
		startGame:startGame,
		animate:animate,
		setRightDown: function (b){rightDown = b;},
		setLeftDown: function (b){leftDown = b;},
		getPlaying: function (){return playing;},
		getMoverGroup:function (){return moverGroup;},
		getSpeed: function() {return moveSpeed/maxSpeed;},
		resetField:resetField,
		getAcceptInput:function (){return acceptInput;},
	};


}();