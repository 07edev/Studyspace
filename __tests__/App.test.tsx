/**
 * @format
 */

import React from 'react';
import {Modal} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import {WelcomeScreen} from '../src/features/welcome/WelcomeScreen';
import {HomeScreen} from '../src/features/home/HomeScreen';
import {AuthEntry} from '../src/features/auth/AuthEntry';
import {Button} from '../src/shared/ui/Button';

test('guest can enter the app, open one auth modal and return without creating a session', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(tree.root.findAllByType(WelcomeScreen)).toHaveLength(1);
  await ReactTestRenderer.act(() => {
    tree.root.findAllByType(Button).find(button => button.props.title === 'Đăng nhập')!.props.onPress();
  });
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  expect(tree.root.findByType(AuthEntry).props.mode).toBe('login');
  await ReactTestRenderer.act(() => {
    tree.root.findAllByType(Button).find(button => button.props.title === 'Tìm hiểu về đăng ký')!.props.onPress();
  });
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  expect(tree.root.findByType(AuthEntry).props.mode).toBe('register');
  await ReactTestRenderer.act(() => {
    tree.root.findAllByType(Button).find(button => button.props.title === 'Tiếp tục với chế độ Khách')!.props.onPress();
  });
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  expect(tree.root.findAllByType(HomeScreen)).toHaveLength(1);
  await ReactTestRenderer.act(() => tree.unmount());
});
