<template>
  <Menu as="div" class="relative inline-block text-left" v-slot="{ open }">
    <Popover
      :transition="dropdownTransition"
      :show="open"
      :placement="popoverPlacement"
    >
      <template #target>
        <MenuButton as="div">
          <slot v-if="$slots.default" v-bind="{ open }" />
          <Button v-else :active="open" v-bind="button">
            {{ button ? button?.label || null : 'Options' }}
          </Button>
        </MenuButton>
      </template>

      <template #body>
        <MenuItems
          class="mt-2 min-w-40 divide-y divide-outline-gray-modals rounded-lg bg-surface-modal shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none"
          :class="{
            'left-0 origin-top-left': placement == 'left',
            'right-0 origin-top-right': placement == 'right',
            'inset-x-0 origin-top': placement == 'center',
          }"
        >
          <div v-for="group in groups" :key="group.key" class="p-1.5">
            <div
              v-if="group.group && !group.hideLabel"
              class="flex h-7 items-center px-2 text-sm font-medium text-ink-gray-6"
            >
              {{ group.group }}
            </div>
            <MenuItem
              v-for="item in group.items"
              :key="item.label"
              v-slot="{ active }"
            >
              <component
                v-if="item.component"
                :is="item.component"
                :active="active"
              />
              <button
                v-else
                :class="[
                  active ? 'bg-surface-gray-3' : 'text-ink-gray-6',
                  'group flex h-7 w-full items-center rounded px-2 text-base',
                ]"
                @click="item.onClick"
              >
                <FeatherIcon
                  v-if="item.icon && typeof item.icon === 'string'"
                  :name="item.icon"
                  class="mr-2 h-4 w-4 flex-shrink-0 text-ink-gray-6"
                  aria-hidden="true"
                />
                <component
                  class="mr-2 h-4 w-4 flex-shrink-0 text-ink-gray-6"
                  v-else-if="item.icon"
                  :is="item.icon"
                />
                <span class="whitespace-nowrap text-ink-gray-7">
                  {{ item.label }}
                </span>
              </button>
            </MenuItem>
          </div>
        </MenuItems>
      </template>
    </Popover>
  </Menu>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
import { Popover } from '../Popover'
import { Button } from '../Button'
import FeatherIcon from '../FeatherIcon.vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type {
  DropdownProps,
  DropdownOption,
  DropdownGroupOption,
} from './types'

const router = useRouter()

const props = withDefaults(defineProps<DropdownProps>(), {
  options: () => [],
  placement: 'left',
})

const normalizeDropdownItem = (option: DropdownOption) => {
  let onClick = () => {
    if (option.route) {
      router.push(option.route)
    } else if (option.onClick) {
      option.onClick()
    }
  }

  return {
    label: option.label,
    icon: option.icon,
    component: option.component,
    onClick,
  }
}

const filterOptions = (options: DropdownOption[]) => {
  return (options || [])
    .filter(Boolean)
    .filter((option) => (option.condition ? option.condition() : true))
    .map((option) => normalizeDropdownItem(option))
}

const groups = computed(() => {
  let groups: DropdownGroupOption[] = []
  let currentGroup: DropdownGroupOption | null = null
  let i = 0

  for (let option of props.options) {
    if (option == null) {
      continue
    }

    if ('group' in option) {
      if (currentGroup) {
        groups.push(currentGroup)
        currentGroup = null
      }
      let groupOption = {
        key: i,
        ...option,
        items: filterOptions(option.items),
      } as DropdownGroupOption
      groups.push(groupOption)
    } else {
      if (!currentGroup) {
        currentGroup = {
          key: i,
          group: '',
          hideLabel: true,
          items: [],
        } as DropdownGroupOption
      }
      currentGroup.items.push(...filterOptions([option]))
    }
    i++
  }

  if (currentGroup) {
    groups.push(currentGroup)
  }

  return groups
})

const dropdownTransition = computed(() => {
  return {
    enterActiveClass: 'transition duration-100 ease-out',
    enterFromClass: 'transform scale-95 opacity-0',
    enterToClass: 'transform scale-100 opacity-100',
    leaveActiveClass: 'transition duration-75 ease-in',
    leaveFromClass: 'transform scale-100 opacity-100',
    leaveToClass: 'transform scale-95 opacity-0',
  }
})

const popoverPlacement = computed(() => {
  if (props.placement === 'left') return 'bottom-start'
  if (props.placement === 'right') return 'bottom-end'
  if (props.placement === 'center') return 'bottom-center'
  return 'bottom'
})
</script>
