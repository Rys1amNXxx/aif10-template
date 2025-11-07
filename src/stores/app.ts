import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'

export const useAppInfoStore = defineStore('appInfo', () => {

  const skin: Ref<string> = ref('light');

  function setSkin(payload: string) {
    skin.value = payload
  }

  return { skin, setSkin }
})
