import {afterEach, describe, expect, it, vi} from 'vitest';
import {WfmClient} from '../src/lib/wfm/client';

afterEach(() => vi.unstubAllGlobals());

describe('WfmClient external response handling', () => {
  it('drops malformed order entries before they reach price calculation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({data:[
      {id:'order-1',type:'sell',platinum:12,visible:true,user:{status:'ingame'}},
      {id:'bad-price',type:'sell',platinum:'cheap',user:{}},
      null
    ]}), {status:200,headers:{'Content-Type':'application/json'}})));
    await expect(new WfmClient().getOrders('test_item')).resolves.toEqual([
      {id:'order-1',type:'sell',platinum:12,visible:true,user:{status:'ingame'}}
    ]);
  });
});
