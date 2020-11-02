const { IamAuthenticator } = require('ibm-vpc/auth');
const VpcV1 = require('ibm-vpc/vpc/v1');

// Create an IAM authenticator.
const authenticator = new IamAuthenticator({
  apikey: '<api-key>',
});

// Construct the service client.
const vpcService = new VpcV1({
    authenticator,                                          // required
    serviceUrl: 'https://us-south.iaas.cloud.ibm.com/v1', // optional
});

const instanceId = "<instaince_id>";
const subnetId = "<subnet_id>";
const nlbName = "nodesdk-nlb-test-1";
const listenerPort = 234;
const memberPort = 234;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkLbActive(lbId) {
    const params = {id: lbId};
    var lb;
    do {
        var lb = await vpcService.getLoadBalancer(params)
        console.log("LB is in " + lb.result.provisioning_status + " state")
        // const second = 1000
        await sleep(30 * 1000);
    } while(lb.result.provisioning_status != "active");
}

async function listLbs() {
    console.log("\nListing all load balancers in us-south ...")
    const params = {};
    var lbs = await vpcService.listLoadBalancers(params);
    lbs.result.load_balancers.forEach((item, _) => {
        console.log(item)
    })
}

async function createNlb() {
    console.log("\nCreating network load balancer ...")
    // SubnetIdentityById
    const subnetIdentityModel = {
        id: subnetId,
    };

    // LoadBalancerPoolIdentityByName
    const loadBalancerPoolIdentityByNameModel = {
        name: 'my-load-balancer-pool',
    };

    // LoadBalancerListenerPrototypeLoadBalancerContext
    const loadBalancerListenerPrototypeLoadBalancerContextModel = {
        port: listenerPort,
        protocol: 'tcp',
        default_pool: loadBalancerPoolIdentityByNameModel,
    };

    // LoadBalancerPoolHealthMonitorPrototype
    const loadBalancerPoolHealthMonitorPrototypeModel = {
        delay: 5,
        max_retries: 2,
        port: 22,
        timeout: 2,
        type: 'http',
        url_path: '/',
    };

    // LoadBalancerPoolMemberTargetPrototypeInstanceIdentityInstanceIdentityById
    const loadBalancerPoolMemberTargetPrototypeModel = {
        id: instanceId,
    };

    // LoadBalancerPoolMemberPrototype
    const loadBalancerPoolMemberPrototypeModel = {
        port: memberPort,
        weight: 50,
        target: loadBalancerPoolMemberTargetPrototypeModel,
    };

    // LoadBalancerPoolSessionPersistencePrototype
    const loadBalancerPoolSessionPersistencePrototypeModel = {
        type: 'source_ip',
    };

    // LoadBalancerPoolPrototype
    const loadBalancerPoolPrototypeModel = {
        name: 'my-load-balancer-pool',
        algorithm: 'least_connections',
        protocol: 'tcp',
        health_monitor: loadBalancerPoolHealthMonitorPrototypeModel,
        members: [loadBalancerPoolMemberPrototypeModel],
        session_persistence: loadBalancerPoolSessionPersistencePrototypeModel,
    };

    // LoadBalancerProfileIdentityByName
    const loadBalancerProfileIdentityModel = {
        name: 'network-fixed',
    };

    const isPublic = true;
    const subnets = [subnetIdentityModel];
    const name = nlbName;
    const listeners = [loadBalancerListenerPrototypeLoadBalancerContextModel];
    const pools = [loadBalancerPoolPrototypeModel];
    const profile = loadBalancerProfileIdentityModel;

    const params = {
        isPublic: isPublic,
        subnets: subnets,
        name: name,
        listeners: listeners,
        pools: pools,
        profile: profile,
    };
    try {
        var lb = await vpcService.createLoadBalancer(params)
        console.log(lb)
    } catch(e) {
        console.log(e.message)
        throw 500
    };
    
    return lb.result
}

async function deleteListener(lbId, listenerId) {
    console.log("\nDeleting listener " + listenerId + " ...");
    var params = {
        loadBalancerId: lbId,
        id: listenerId
    };
    try {
        var resp = await vpcService.deleteLoadBalancerListener(params);
        console.log("status: " + resp.status.toString())
    } catch(e) {
        console.log(e.message)
        throw 500
    };
    console.log("Delete listener request sent.")
}

async function deleteMember(lbId, poolId) {
    var params = {
        loadBalancerId: lbId,
        id: poolId
    }
    var pools = await vpcService.getLoadBalancerPool(params)
    var memberId = pools.result.members.pop().id

    console.log("\nDeleting member " +  memberId + " of pool  " + poolId + "...");
    var params = {
        loadBalancerId: lbId,
        poolId: poolId,
        id: memberId
    }
    try {
        var resp = vpcService.deleteLoadBalancerPoolMember(params);
        console.log("status: " + (await resp).status.toString())
    } catch(e) {
        console.log(e.message)
        throw 500
    }
    console.log("Delete member request sent.") 
}

async function deletePool(lbId, poolId) {
    console.log("\nDeleting pool " + poolId + "...");
    var params = {
        loadBalancerId: lbId,
        id: poolId
    }
    try {
        var resp = await vpcService.deleteLoadBalancerPool(params);
        console.log("status: " + resp.status.toString())
    } catch(e) {
        console.log(e.message)
        throw 500
    }
    console.log("Delete pool request sent.")
}

async function createPool(lbId) {
    console.log("\nCreating pool ...")
    // LoadBalancerPoolHealthMonitorPrototype
    const loadBalancerPoolHealthMonitorPrototypeModel = {
        delay: 20,
        max_retries: 3,
        port: 6060,
        timeout: 10,
        type: 'tcp',
    };

    // LoadBalancerPoolPrototype
    const params = {
        loadBalancerId: lbId,
        name: 'my-pool',
        algorithm: 'round_robin',
        protocol: 'tcp',
        healthMonitor: loadBalancerPoolHealthMonitorPrototypeModel,
    };

    try {
        var pool = await vpcService.createLoadBalancerPool(params);
        console.log(pool)
    } catch(e) {
        console.log(e.message)
        throw 500
    }
    console.log("Create pool request sent.")
    return pool.result.id;
}

async function createMember(lbId, poolId) {
    console.log("\nCreating member ...")
    // LoadBalancerPoolMemberTargetPrototypeInstanceIdentityInstanceIdentityById
    const loadBalancerPoolMemberTargetPrototypeModel = {
        id: instanceId,
    };

    var params = {
        loadBalancerId: lbId,
        poolId: poolId,
        port: memberPort,
        weight: 50,
        target: loadBalancerPoolMemberTargetPrototypeModel,
    }
    try {
        var member = await vpcService.createLoadBalancerPoolMember(params);
        console.log(member)
    } catch(e) {
        console.log(e.message)
        throw 500
    }
    console.log("Create member request sent.")
    return member.result.id
}

async function createListener(lbId, poolId) {
    console.log("\nCreating listener ...")
    // LoadBalancerPoolIdentityById
    const loadBalancerPoolIdentityModel = {
        id: poolId,
    };
    const params = {
        loadBalancerId: lbId,
        port: listenerPort,
        protocol: "tcp",
        defaultPool: loadBalancerPoolIdentityModel,
    }
    try {
        var listener = await vpcService.createLoadBalancerListener(params);
        console.log(listener)
    } catch(e) {
        console.log(e.message)
        throw 500
    }
    console.log("Create listener request sent.")
    return listener.result.id
}

async function updateListener(lbId, listenerId) {
    console.log("\nUpdating listener ...")
    const params = {
        loadBalancerId: lbId,
        id: listenerId,
        port: 1010,
    }
    try {
        var listener = await vpcService.updateLoadBalancerListener(params);
        console.log(listener)
    } catch(e) {
        console.log(e.message)
        throw 500
    }
    console.log("Update listener request sent.")
}

async function updatePool(lbId, poolId) {
    console.log("\nUpdating pool ...")
    // LoadBalancerPoolHealthMonitorPrototype
    const loadBalancerPoolHealthMonitorPrototypeModel = {
        delay: 30,
        max_retries: 2,
        port: 7070,
        timeout: 6,
        type: 'http',
        url_path: "/hello",
    };

    // LoadBalancerPoolPrototype
    const params = {
        loadBalancerId: lbId,
        id: poolId,
        name: 'my-pool-test',
        algorithm: 'weighted_round_robin',
        protocol: 'tcp',
        healthMonitor: loadBalancerPoolHealthMonitorPrototypeModel,
    };

    try {
        var pool = await vpcService.updateLoadBalancerPool(params);
        console.log(pool)
    } catch(e) {
        console.log(e.message)
        throw 500
    }
    console.log("Update pool request sent.")
}

async function updateMember(lbId, poolId, memberId) {
    console.log("\nUpdating member ...")
    var params = {
        loadBalancerId: lbId,
        poolId: poolId,
        id: memberId,
        port: 9090,
        weight: 80
    }
    try {
        var member = await vpcService.updateLoadBalancerPoolMember(params);
        console.log(member)
    } catch(e) {
        console.log(e.message)
        throw 500
    }
    console.log("Update member request sent.")
}

async function deleteLb(lbId) {
    console.log("Updating member ...")
    var params = {
        id: lbId
    }
    try {
        var resp = await vpcService.deleteLoadBalancer(params);
        console.log("status: " + resp.status.toString())
    } catch(e) {
        console.log(e.message)
        throw 500
    }
    console.log("Delete NLB request sent.")
}

async function test_node_sdk_lb() {
    await listLbs();
    var lb = await createNlb();
    await checkLbActive(lb.id);
    var listener = lb.listeners.pop()
    await deleteListener(lb.id, listener.id);
    await checkLbActive(lb.id);
    var pool = lb.pools.pop()
    await deleteMember(lb.id, pool.id);
    await checkLbActive(lb.id);
    await deletePool(lb.id, pool.id);
    await checkLbActive(lb.id);
    var poolId = await createPool(lb.id);
    await checkLbActive(lb.id);
    var memberId = await createMember(lb.id, poolId);
    await checkLbActive(lb.id);
    var listenerId = await createListener(lb.id, poolId)
    await checkLbActive(lb.id);
    await updateListener(lb.id, listenerId)
    await checkLbActive(lb.id);
    await updatePool(lb.id, poolId)
    await checkLbActive(lb.id);
    await updateMember(lb.id, poolId, memberId)
    await checkLbActive(lb.id);
    deleteLb(lb.id);
}

test_node_sdk_lb()




